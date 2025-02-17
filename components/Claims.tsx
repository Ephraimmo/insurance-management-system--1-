import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, AlertCircle, Upload, FileText, CheckCircle2, Search, Download, Eye, Pencil, Plus } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc, updateDoc, setDoc, writeBatch } from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { db, storage } from "@/src/FirebaseConfg"
import { toast } from "@/components/ui/use-toast"
import { format } from "date-fns"
import { ContractSummary } from "@/components/contract/ContractSummary"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { saveClaimData, generateClaimNumber } from "@/src/claimFunctions"

type PolicyDetails = {
  policyNumber: string
  holderName: string
  status: string
  coverageAmount: number
  startDate: Date
  type: string
}

type ClaimDocument = {
  type: string
  file: File
  status: "uploading" | "completed" | "error"
  url?: string
}

type ClaimFormData = {
  policyNumber: string
  claimantName: string
  claimantContact: string
  relationship: string
  serviceDate: string
  serviceProvider: string
  location: string
  documents: ClaimDocument[]
  accountHolder?: string
  bankName?: string
  accountType?: string
  accountNumber?: string
  branchCode?: string
}

type ClaimTrackingData = {
  claimNumber: string
  submissionDate: Date
  status: string
  policyNumber: string
  claimantName: string
  documents: Array<{
    type: string
    url: string
  }>
}

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

// Add new type for deceased information
type DeceasedInfo = {
  firstName: string
  lastName: string
  idNumber: string
  dateOfDeath: string
  causeOfDeath: string
  placeOfDeath: string
  relationship: string
}

interface ClaimsProps {
  userRole?: string
}

export function Claims({ userRole }: ClaimsProps) {
  const canEdit = userRole && userRole !== 'View Only'

  const [activeTab, setActiveTab] = useState("policy-lookup")
  const [loading, setLoading] = useState(false)
  const [policyNumber, setPolicyNumber] = useState("")
  const [policyDetails, setPolicyDetails] = useState<PolicyDetails | null>(null)
  const [documents, setDocuments] = useState<ClaimDocument[]>([])
  const [formData, setFormData] = useState<ClaimFormData>({
    policyNumber: "",
    claimantName: "",
    claimantContact: "",
    relationship: "",
    serviceDate: "",
    serviceProvider: "",
    location: "",
    documents: [],
    accountHolder: "",
    bankName: "",
    accountType: "",
    accountNumber: "",
    branchCode: ""
  })
  const [trackingNumber, setTrackingNumber] = useState("")
  const [trackedClaims, setTrackedClaims] = useState<ClaimTrackingData[]>([])
  const [loadingTracking, setLoadingTracking] = useState(false)
  const [contractData, setContractData] = useState<ContractData | null>(null)
  const [successDialogOpen, setSuccessDialogOpen] = useState(false)
  const [submittedClaimDetails, setSubmittedClaimDetails] = useState<{
    claimNumber: string;
    claimantName: string;
    serviceDate: string;
    serviceProvider: string;
    status: string;
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deceasedInfo, setDeceasedInfo] = useState<DeceasedInfo>({
    firstName: "",
    lastName: "",
    idNumber: "",
    dateOfDeath: "",
    causeOfDeath: "",
    placeOfDeath: "",
    relationship: ""
  })
  const [claimNumber, setClaimNumber] = useState<string>("")
  const [viewingDocument, setViewingDocument] = useState<{ url: string; type: string } | null>(null)
  const [isImageLoading, setIsImageLoading] = useState(false)
  const [claimStatus, setClaimStatus] = useState<string>("FNOL")
  const [claimDetails, setClaimDetails] = useState<{
    claimNumber: string;
    status: string;
  } | null>(null)

  const handlePolicyLookup = async () => {
    if (!policyNumber.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a policy number"
      })
      return
    }

    try {
      setLoading(true)
      
      // First check if contract exists
      const contractsRef = collection(db, 'Contracts')
      const contractQuery = query(contractsRef, where("contractNumber", "==", policyNumber))
      const contractSnapshot = await getDocs(contractQuery)

      if (contractSnapshot.empty) {
        toast({
          variant: "destructive",
          title: "Not Found",
          description: "No contract found with the provided number"
        })
        setPolicyDetails(null)
        setContractData(null)
        return
      }

      const contractDoc = contractSnapshot.docs[0]
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
          name: policiesData?.name || 'Unknown Plan',
          coverAmount: policiesData?.coverAmount?.toString() || '0',
          premium: policiesData?.premium || null
        },
        cateringOptions: cateringOptionsData,
        status: contractData.status
      }

      setContractData(fullContractData)
      setPolicyDetails({
        policyNumber: contractData.contractNumber,
        holderName: `${memberData?.firstName} ${memberData?.lastName}`,
        status: contractData.status,
        coverageAmount: policiesData?.coverAmount || 0,
        startDate: contractData.startDate?.toDate() || new Date(),
        type: policiesData?.name || 'Unknown'
      })

      // Auto-fill policy number in claim form
      setFormData(prev => ({ ...prev, policyNumber }))
      
    } catch (error) {
      console.error('Error looking up policy:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to lookup policy. Please try again."
      })
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (file: File, documentType: string) => {
    try {
      // Add document to state with uploading status
      const newDocument: ClaimDocument = {
        type: documentType,
        file,
        status: "uploading"
      }
      setDocuments(prev => [...prev, newDocument])

      // Upload to Firebase Storage
      const timestamp = Date.now()
      const fileName = `claims/${policyNumber}/${documentType}_${timestamp}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
      const fileRef = ref(storage, fileName)
      
      await uploadBytes(fileRef, file)
      const downloadUrl = await getDownloadURL(fileRef)

      // Update document status and URL
      setDocuments(prev => prev.map(doc => 
        doc.file === file 
          ? { ...doc, status: "completed", url: downloadUrl }
          : doc
      ))

      toast({
        title: "Success",
        description: "Document uploaded successfully"
      })
    } catch (error) {
      console.error('Error uploading document:', error)
      setDocuments(prev => prev.map(doc => 
        doc.file === file 
          ? { ...doc, status: "error" }
          : doc
      ))
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to upload document. Please try again."
      })
    }
  }

  const handleSubmitClaim = async () => {
    try {
      setSubmitting(true)
      setError(null)

      // Validate required fields
      if (!policyNumber || !formData.serviceDate || !formData.serviceProvider || !formData.location) {
        setError("Please fill in all required fields")
        return
      }

      // Validate required documents
      const requiredDocs = ['Death Certificate', 'ID Document']
      const hasAllRequiredDocs = requiredDocs.every(docType =>
        documents.some(doc => doc.type === docType && doc.status === "completed")
      )
      if (!hasAllRequiredDocs) {
        setError("Please upload all required documents")
        return
      }

      // Generate claim number
      const claimNumber = await generateClaimNumber()

      // Save claim data
      const result = await saveClaimData({
        claimNumber,
        contractNumber: contractData?.mainMember.contractNumber || "",
        policyDetails: {
          policyNumber,
          holderName: contractData?.mainMember.personalInfo.firstName + " " + contractData?.mainMember.personalInfo.lastName,
          coverageAmount: parseFloat(contractData?.policiesDetails.coverAmount || "0")
        },
        deceasedInfo,
        bankDetails: {
          accountHolder: formData.accountHolder || "",
          bankName: formData.bankName || "",
          accountType: formData.accountType || "",
          accountNumber: formData.accountNumber || "",
          branchCode: formData.branchCode || ""
        },
        documents: documents
          .filter(doc => doc.status === "completed" && doc.url)
          .map(doc => ({
            type: doc.type,
            url: doc.url || ""
          })),
        claimDetails: {
          claimantName: formData.claimantName,
          relationship: formData.relationship,
          serviceDate: formData.serviceDate,
          serviceProvider: formData.serviceProvider,
          location: formData.location,
          status: "FNOL"
        }
      })

      if (result.success) {
        // Show success dialog
        setSubmittedClaimDetails({
          claimNumber,
          status: "FNOL",
          claimantName: formData.claimantName,
          serviceDate: formData.serviceDate,
          serviceProvider: formData.serviceProvider
        })
        setSuccessDialogOpen(true)

        // Reset form
        setFormData({
          policyNumber: "",
          claimantName: "",
          claimantContact: "",
          relationship: "",
          serviceDate: "",
          serviceProvider: "",
          location: "",
          documents: [],
          accountHolder: "",
          bankName: "",
          accountType: "",
          accountNumber: "",
          branchCode: ""
        })
        setDocuments([])
        setDeceasedInfo({
          firstName: "",
          lastName: "",
          idNumber: "",
          dateOfDeath: "",
          causeOfDeath: "",
          placeOfDeath: "",
          relationship: ""
        })

        // Move to tracking tab
        setActiveTab("tracking")
      } else {
        throw new Error("Failed to save claim data")
      }
    } catch (error) {
      console.error('Error submitting claim:', error)
      setError("Failed to submit claim. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleTrackClaim = async () => {
    if (!trackingNumber.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a claim number"
      })
      return
    }

    try {
      setLoadingTracking(true)
      const claimsRef = collection(db, 'Claims')
      const q = query(
        claimsRef,
        where("claimNumber", "==", trackingNumber)
      )
      const querySnapshot = await getDocs(q)

      if (querySnapshot.empty) {
        toast({
          variant: "destructive",
          title: "Not Found",
          description: "No claim found with the provided number"
        })
        return
      }

      const claims = querySnapshot.docs.map(doc => {
        const data = doc.data()
        return {
          claimNumber: data.claimNumber,
          submissionDate: data.submissionDate?.toDate() || new Date(),
          status: data.status,
          policyNumber: data.policyNumber,
          claimantName: data.claimantName,
          documents: data.documents || []
        }
      })

      setTrackedClaims(claims)
    } catch (error) {
      console.error('Error tracking claim:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to track claim. Please try again."
      })
    } finally {
      setLoadingTracking(false)
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'secondary'
      case 'approved':
        return 'default'
      case 'rejected':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  const handleTabChange = (value: string) => {
    if (value === "documents" || value === "claim-form" || value === "bank-details" || value === "claim-summary") {
      if (!policyDetails) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Please complete policy lookup first"
        })
        return
      }
    }

    if ((value === "documents" || value === "bank-details" || value === "claim-summary") && !deceasedInfo.firstName) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please complete deceased information first"
      })
      return
    }

    if ((value === "documents" || value === "claim-summary") && (!formData.bankName || !formData.accountNumber || !formData.branchCode || !documents.some(doc => doc.type === "Bank Statement" && doc.status === "completed"))) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please complete bank details and upload bank statement first"
      })
      return
    }

    if (value === "claim-summary" && (!formData.serviceDate || !formData.serviceProvider || !formData.location)) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please complete all claim form details before viewing summary"
      })
      return
    }

    setActiveTab(value)
  }

  const handleStatusChange = async (newStatus: string) => {
    try {
      if (!claimNumber) return;

      const claimsRef = collection(db, 'Claims')
      const q = query(claimsRef, where("claimNumber", "==", claimNumber))
      const querySnapshot = await getDocs(q)
      
      if (!querySnapshot.empty) {
        const docRef = querySnapshot.docs[0].ref
        await updateDoc(docRef, { status: newStatus })
        setClaimStatus(newStatus)
        
        toast({
          title: "Success",
          description: "Claim status updated successfully"
        })
      }
    } catch (error) {
      console.error('Error updating claim status:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update claim status"
      })
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Funeral Claims Processing</h1>
        <p className="text-muted-foreground">Submit and track funeral benefit claims</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="policy-lookup">Policy Lookup</TabsTrigger>
          <TabsTrigger value="deceased">Deceased</TabsTrigger>
          <TabsTrigger value="bank-details">Bank Details</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="claim-form">Claim Form</TabsTrigger>
          <TabsTrigger value="claim-summary">Summary</TabsTrigger>
          <TabsTrigger value="tracking">Tracking</TabsTrigger>
        </TabsList>

        <TabsContent value="policy-lookup">
          <Card>
            <CardHeader>
              <CardTitle>Policy Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label htmlFor="policyNumber">Contract Number</Label>
                  <Input
                    id="policyNumber"
                    placeholder="Enter contract number"
                    value={policyNumber}
                    onChange={(e) => setPolicyNumber(e.target.value)}
                  />
                </div>
                <Button
                  className="mt-8"
                  onClick={handlePolicyLookup}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Lookup Contract
                    </>
                  )}
                </Button>
              </div>

              {contractData && (
                <div className="space-y-4">
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>Contract Found</AlertTitle>
                    <AlertDescription>
                      Contract details have been retrieved successfully.
                    </AlertDescription>
                  </Alert>

                  <Card className="mt-6">
                    <CardContent className="pt-6">
                      <ContractSummary
                        data={contractData}
                        onEdit={() => {}}
                      />
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deceased">
          <Card>
            <CardHeader>
              <CardTitle>Deceased Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6">
                <div className="space-y-2">
                  <Label htmlFor="memberSelect">Select Deceased Person</Label>
                  <Select
                    onValueChange={(value) => {
                      if (!contractData) return;

                      if (value === "main") {
                        // Auto-fill main member details
                        const mainMember = contractData.mainMember.personalInfo;
                        setDeceasedInfo({
                          firstName: mainMember.firstName,
                          lastName: mainMember.lastName,
                          idNumber: mainMember.idNumber,
                          dateOfDeath: "",
                          causeOfDeath: "",
                          placeOfDeath: "",
                          relationship: "Main Policy Holder"
                        });
                        // Set formData for main member case
                        setFormData(prev => ({
                          ...prev,
                          claimantName: contractData.beneficiaries[0]?.personalInfo.firstName + " " + contractData.beneficiaries[0]?.personalInfo.lastName,
                          relationship: contractData.beneficiaries[0]?.personalInfo.relationshipToMainMember || "Beneficiary"
                        }));
                      } else {
                        // Auto-fill dependent details
                        const dependent = contractData.dependents.find(
                          dep => dep.personalInfo.idNumber === value
                        );
                        if (dependent) {
                          const personalInfo = dependent.personalInfo;
                          setDeceasedInfo({
                            firstName: personalInfo.firstName,
                            lastName: personalInfo.lastName,
                            idNumber: personalInfo.idNumber,
                            dateOfDeath: "",
                            causeOfDeath: "",
                            placeOfDeath: "",
                            relationship: personalInfo.relationshipToMainMember
                          });
                          // Set formData for dependent case
                          setFormData(prev => ({
                            ...prev,
                            claimantName: contractData.mainMember.personalInfo.firstName + " " + contractData.mainMember.personalInfo.lastName,
                            relationship: "Main Policy Holder"
                          }));
                        }
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select person" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="main">
                        {contractData?.mainMember.personalInfo.firstName} {contractData?.mainMember.personalInfo.lastName} (Main Member)
                      </SelectItem>
                      {contractData?.dependents.map((dependent) => (
                        <SelectItem 
                          key={dependent.personalInfo.idNumber} 
                          value={dependent.personalInfo.idNumber}
                        >
                          {dependent.personalInfo.firstName} {dependent.personalInfo.lastName} ({dependent.personalInfo.relationshipToMainMember})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={deceasedInfo.firstName}
                      onChange={(e) => setDeceasedInfo(prev => ({ ...prev, firstName: e.target.value }))}
                      placeholder="Enter first name"
                      disabled
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={deceasedInfo.lastName}
                      onChange={(e) => setDeceasedInfo(prev => ({ ...prev, lastName: e.target.value }))}
                      placeholder="Enter last name"
                      disabled
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="idNumber">ID Number</Label>
                    <Input
                      id="idNumber"
                      value={deceasedInfo.idNumber}
                      onChange={(e) => setDeceasedInfo(prev => ({ ...prev, idNumber: e.target.value }))}
                      placeholder="Enter ID number"
                      disabled
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dateOfDeath">Date of Death</Label>
                    <Input
                      id="dateOfDeath"
                      type="date"
                      value={deceasedInfo.dateOfDeath}
                      onChange={(e) => setDeceasedInfo(prev => ({ ...prev, dateOfDeath: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="causeOfDeath">Cause of Death</Label>
                  <Input
                    id="causeOfDeath"
                    value={deceasedInfo.causeOfDeath}
                    onChange={(e) => setDeceasedInfo(prev => ({ ...prev, causeOfDeath: e.target.value }))}
                    placeholder="Enter cause of death"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="placeOfDeath">Place of Death</Label>
                  <Input
                    id="placeOfDeath"
                    value={deceasedInfo.placeOfDeath}
                    onChange={(e) => setDeceasedInfo(prev => ({ ...prev, placeOfDeath: e.target.value }))}
                    placeholder="Enter place of death"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="relationship">Relationship to Policy Holder</Label>
                  <Input
                    id="relationship"
                    value={deceasedInfo.relationship}
                    disabled
                  />
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Important</AlertTitle>
                  <AlertDescription>
                    Please ensure all information provided is accurate and matches the death certificate.
                  </AlertDescription>
                </Alert>

                <div className="flex justify-end gap-4">
                  <Button variant="outline" onClick={() => setActiveTab("policy-lookup")}>
                    Back
                  </Button>
                  <Button onClick={() => setActiveTab("bank-details")}>
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bank-details">
          <Card>
            <CardHeader>
              <CardTitle>Bank Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6">
                <div className="space-y-2">
                  <Label>Account Holder Name</Label>
                  <Input
                    value={formData.accountHolder || (deceasedInfo.relationship === "Main Policy Holder" 
                      ? contractData?.beneficiaries[0]?.personalInfo.firstName + " " + contractData?.beneficiaries[0]?.personalInfo.lastName
                      : contractData?.mainMember.personalInfo.firstName + " " + contractData?.mainMember.personalInfo.lastName)}
                    disabled
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Bank Name</Label>
                    <Select
                      onValueChange={(value) => setFormData(prev => ({ ...prev, bankName: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select bank" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ABSA">ABSA</SelectItem>
                        <SelectItem value="Capitec">Capitec</SelectItem>
                        <SelectItem value="FNB">FNB</SelectItem>
                        <SelectItem value="Nedbank">Nedbank</SelectItem>
                        <SelectItem value="Standard Bank">Standard Bank</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Account Type</Label>
                    <Select
                      onValueChange={(value) => setFormData(prev => ({ ...prev, accountType: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Savings">Savings</SelectItem>
                        <SelectItem value="Cheque">Cheque</SelectItem>
                        <SelectItem value="Current">Current</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Account Number</Label>
                  <Input
                    placeholder="Enter account number"
                    value={formData.accountNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, accountNumber: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Branch Code</Label>
                  <Input
                    placeholder="Enter branch code"
                    value={formData.branchCode}
                    onChange={(e) => setFormData(prev => ({ ...prev, branchCode: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    Bank Statement
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-sm text-muted-foreground">
                            (Required)
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Upload a recent bank statement - this is required</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <div className="flex items-center gap-4">
                    <Input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      id="bank-statement-upload"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleFileUpload(file, "Bank Statement")
                      }}
                    />
                    <Button
                      type="button"
                      variant={documents.some(doc => doc.type === "Bank Statement") ? "outline" : "secondary"}
                      onClick={() => document.getElementById('bank-statement-upload')?.click()}
                      className="flex items-center gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      {documents.some(doc => doc.type === "Bank Statement") ? 'Change Bank Statement' : 'Upload Bank Statement *'}
                    </Button>
                    {documents.some(doc => doc.type === "Bank Statement" && doc.status === "completed") && (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-muted-foreground">Bank Statement uploaded</span>
                      </div>
                    )}
                    {documents.some(doc => doc.type === "Bank Statement" && doc.status === "uploading") && (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">Uploading...</span>
                      </div>
                    )}
                  </div>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Important</AlertTitle>
                  <AlertDescription>
                    Please ensure all banking details are accurate. Incorrect details may delay claim payment.
                  </AlertDescription>
                </Alert>

                <div className="flex justify-end gap-4">
                  <Button variant="outline" onClick={() => setActiveTab("deceased")}>
                    Back
                  </Button>
                  <Button onClick={() => setActiveTab("documents")}>
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Required Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <h3 className="font-semibold">Mandatory Documents</h3>
                  <div className="space-y-4">
                    {['Death Certificate', 'ID Document'].map((docType) => (
                      <div key={docType} className="space-y-2">
                        <Label className="flex items-center gap-2">
                          {docType}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-sm text-muted-foreground">
                                  (Required)
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>This document is required for claim processing</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </Label>
                        <div className="flex items-center gap-4">
                          <Input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            id={`${docType}-upload`}
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleFileUpload(file, docType)
                            }}
                          />
                          <Button
                            type="button"
                            variant={documents.some(doc => doc.type === docType) ? "outline" : "secondary"}
                            onClick={() => document.getElementById(`${docType}-upload`)?.click()}
                            className="flex items-center gap-2"
                          >
                            <Upload className="h-4 w-4" />
                            {documents.some(doc => doc.type === docType) ? `Change ${docType}` : `Upload ${docType} *`}
                          </Button>
                          {documents.some(doc => doc.type === docType && doc.status === "completed") && (
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              <span className="text-sm text-muted-foreground">{docType} uploaded</span>
                            </div>
                          )}
                          {documents.some(doc => doc.type === docType && doc.status === "uploading") && (
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span className="text-sm text-muted-foreground">Uploading...</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold">Additional Documents</h3>
                  <div className="space-y-4">
                    {['Funeral Invoice', 'Medical Certificate', 'Other'].map((docType) => (
                      <div key={docType} className="space-y-2">
                        <Label className="flex items-center gap-2">
                          {docType}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-sm text-muted-foreground">
                                  (Optional)
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Upload {docType} if available</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </Label>
                        <div className="flex items-center gap-4">
                          <Input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            id={`${docType}-upload`}
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleFileUpload(file, docType)
                            }}
                          />
                          <Button
                            type="button"
                            variant={documents.some(doc => doc.type === docType) ? "outline" : "secondary"}
                            onClick={() => document.getElementById(`${docType}-upload`)?.click()}
                            className="flex items-center gap-2"
                          >
                            <Upload className="h-4 w-4" />
                            {documents.some(doc => doc.type === docType) ? `Change ${docType}` : `Upload ${docType}`}
                          </Button>
                          {documents.some(doc => doc.type === docType && doc.status === "completed") && (
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2 text-green-500">
                                <CheckCircle2 className="h-4 w-4" />
                                <span>Uploaded</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const doc = documents.find(d => d.type === docType)
                                  if (doc?.url) {
                                    setViewingDocument({ url: doc.url, type: docType })
                                  }
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                          {documents.some(doc => doc.type === docType && doc.status === "uploading") && (
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span className="text-sm text-muted-foreground">Uploading...</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <Alert>
                <FileText className="h-4 w-4" />
                <AlertTitle>Document Requirements</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Accepted formats: PDF, JPG, PNG</li>
                    <li>Maximum file size: 10MB per document</li>
                    <li>Documents must be clear and legible</li>
                    <li>Mandatory Documents: Death Certificate and ID Document must be uploaded</li>
                    <li>Optional Documents: Funeral Invoice, Medical Certificate and Other supporting documents</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <div className="flex justify-end gap-4">
                <Button variant="outline" onClick={() => setActiveTab("bank-details")}>
                  Back
                </Button>
                <Button 
                  onClick={() => setActiveTab("claim-form")}
                  disabled={!documents.some(doc => doc.status === "completed")}
                >
                  Continue to Claim Form
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="claim-form">
          <Card>
            <CardHeader>
              <CardTitle>Claim Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
    <div>
                    <Label>Contract Number</Label>
                    <Input
                      value={contractData?.mainMember.contractNumber || ""}
                      disabled
                    />
                  </div>
                  <div>
                    <Label>Claim Number</Label>
                    <Input
                      value={claimNumber || "Will be generated on submission"}
                      disabled
                    />
                  </div>
                  <div>
                    <Label>Claimant Name</Label>
                    <Input
                      value={formData.claimantName || (deceasedInfo.relationship === "Main Policy Holder" 
                        ? contractData?.beneficiaries[0]?.personalInfo.firstName + " " + contractData?.beneficiaries[0]?.personalInfo.lastName
                        : contractData?.mainMember.personalInfo.firstName + " " + contractData?.mainMember.personalInfo.lastName)}
                      onChange={(e) => setFormData(prev => ({ ...prev, claimantName: e.target.value }))}
                      disabled
                    />
                  </div>
                  <div>
                    <Label>Relationship to Deceased</Label>
                    <Input
                      value={formData.relationship || (deceasedInfo.relationship === "Main Policy Holder"
                        ? contractData?.beneficiaries[0]?.personalInfo.relationshipToMainMember || "Beneficiary"
                        : "Main Policy Holder")}
                      onChange={(e) => setFormData(prev => ({ ...prev, relationship: e.target.value }))}
                      disabled
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label>Service Date</Label>
                    <Input
                      type="date"
                      value={formData.serviceDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, serviceDate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Service Provider</Label>
                    <Input
                      value={formData.serviceProvider}
                      onChange={(e) => setFormData(prev => ({ ...prev, serviceProvider: e.target.value }))}
                      placeholder="Enter service provider name"
                    />
                  </div>
                  <div>
                    <Label>Location</Label>
                    <Input
                      value={formData.location}
                      onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                      placeholder="Enter service location"
                    />
                  </div>
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Important Notice</AlertTitle>
                <AlertDescription>
                  Please ensure all information provided is accurate. False or misleading information may result in claim rejection.
                </AlertDescription>
              </Alert>

              <div className="flex justify-end gap-4">
                <Button variant="outline" onClick={() => setActiveTab("documents")}>
                  Back
                </Button>
                <Button onClick={handleSubmitClaim} disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Claim"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="claim-summary">
          <Card>
            <CardHeader>
              <CardTitle>Claim Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="policy" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="policy">Policy Information</TabsTrigger>
                  <TabsTrigger value="deceased">Deceased Information</TabsTrigger>
                  <TabsTrigger value="bank">Bank Details</TabsTrigger>
                  <TabsTrigger value="documents">Documents</TabsTrigger>
                  <TabsTrigger value="claim">Claim Details</TabsTrigger>
                </TabsList>

                <TabsContent value="policy">
                  <Table>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">Contract Number</TableCell>
                        <TableCell>{contractData?.mainMember.contractNumber}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Policy Holder</TableCell>
                        <TableCell>
                          {contractData?.mainMember.personalInfo.firstName} {contractData?.mainMember.personalInfo.lastName}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Cover Amount</TableCell>
                        <TableCell>R {contractData?.policiesDetails.coverAmount}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Policy Status</TableCell>
                        <TableCell>
                          <Badge variant="outline">{contractData?.status || 'Active'}</Badge>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="deceased">
                  <Table>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">Full Name</TableCell>
                        <TableCell>{deceasedInfo.firstName} {deceasedInfo.lastName}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">ID Number</TableCell>
                        <TableCell>{deceasedInfo.idNumber}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Date of Death</TableCell>
                        <TableCell>{deceasedInfo.dateOfDeath}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Cause of Death</TableCell>
                        <TableCell>{deceasedInfo.causeOfDeath}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Place of Death</TableCell>
                        <TableCell>{deceasedInfo.placeOfDeath}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Relationship to Policy Holder</TableCell>
                        <TableCell>{deceasedInfo.relationship}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="bank">
                  <Table>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">Account Holder</TableCell>
                        <TableCell>{formData.accountHolder}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Bank Name</TableCell>
                        <TableCell>{formData.bankName}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Account Type</TableCell>
                        <TableCell>{formData.accountType}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Account Number</TableCell>
                        <TableCell>{formData.accountNumber}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Branch Code</TableCell>
                        <TableCell>{formData.branchCode}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="documents">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <h4 className="font-medium mb-2">Mandatory Documents</h4>
                      <Table>
                        <TableBody>
                          {['Death Certificate', 'ID Document', 'Bank Statement'].map((docType) => (
                            <TableRow key={docType}>
                              <TableCell className="font-medium">{docType}</TableCell>
                              <TableCell>
                                {documents.some(doc => doc.type === docType && doc.status === "completed") ? (
                                  <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2 text-green-500">
                                      <CheckCircle2 className="h-4 w-4" />
                                      <span>Uploaded</span>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        const doc = documents.find(d => d.type === docType)
                                        if (doc?.url) {
                                          setViewingDocument({ url: doc.url, type: docType })
                                        }
                                      }}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 text-yellow-500">
                                    <AlertCircle className="h-4 w-4" />
                                    <span>Pending</span>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Optional Documents</h4>
                      <Table>
                        <TableBody>
                          {['Funeral Invoice', 'Medical Certificate', 'Other'].map((docType) => (
                            <TableRow key={docType}>
                              <TableCell className="font-medium">{docType}</TableCell>
                              <TableCell>
                                {documents.some(doc => doc.type === docType && doc.status === "completed") ? (
                                  <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2 text-green-500">
                                      <CheckCircle2 className="h-4 w-4" />
                                      <span>Uploaded</span>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        const doc = documents.find(d => d.type === docType)
                                        if (doc?.url) {
                                          setViewingDocument({ url: doc.url, type: docType })
                                        }
                                      }}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <FileText className="h-4 w-4" />
                                    <span>Not uploaded</span>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="claim">
                  <Table>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">Claim Number</TableCell>
                        <TableCell>{claimNumber || "Will be generated on submission"}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Claimant Name</TableCell>
                        <TableCell>{formData.claimantName}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Relationship to Deceased</TableCell>
                        <TableCell>{formData.relationship}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Service Date</TableCell>
                        <TableCell>{formData.serviceDate}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Service Provider</TableCell>
                        <TableCell>{formData.serviceProvider}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Location</TableCell>
                        <TableCell>{formData.location}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Status</TableCell>
                        <TableCell>
                          <Select
                            value={claimStatus}
                            onValueChange={handleStatusChange}
                          >
                            <SelectTrigger className="w-[200px]">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="FNOL">FNOL</SelectItem>
                              <SelectItem value="under investigation">Under Investigation</SelectItem>
                              <SelectItem value="approved">Approved</SelectItem>
                              <SelectItem value="paid">Paid</SelectItem>
                              <SelectItem value="rejected">Rejected</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-4 mt-6">
                <Button variant="outline" onClick={() => setActiveTab("documents")}>
                  Back to Documents
                </Button>
                <Button onClick={handleSubmitClaim} disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Claim"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tracking">
          <Card>
            <CardHeader>
              <CardTitle>Track Claims</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Label htmlFor="trackingNumber">Claim Number</Label>
                    <Input
                      id="trackingNumber"
                      placeholder="Enter claim number"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                    />
                  </div>
                  <Button
                    className="mt-8"
                    onClick={handleTrackClaim}
                    disabled={loadingTracking}
                  >
                    {loadingTracking ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Search className="mr-2 h-4 w-4" />
                        Track Claim
                      </>
                    )}
                  </Button>
                </div>

                {trackedClaims.length > 0 ? (
                  <div className="space-y-6">
                    {trackedClaims.map((claim) => (
                      <Card key={claim.claimNumber} className="p-6">
                        <div className="space-y-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="text-lg font-semibold">
                                Claim #{claim.claimNumber}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                Submitted on {format(claim.submissionDate, 'PPP')}
                              </p>
                            </div>
                            <Badge variant={getStatusBadgeVariant(claim.status)}>
                              {claim.status}
                            </Badge>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <h4 className="font-medium mb-2">Claim Information</h4>
                              <dl className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <dt className="text-muted-foreground">Policy Number:</dt>
                                  <dd className="font-medium">{claim.policyNumber}</dd>
                                </div>
                                <div className="flex justify-between">
                                  <dt className="text-muted-foreground">Claimant:</dt>
                                  <dd className="font-medium">{claim.claimantName}</dd>
                                </div>
                              </dl>
                            </div>

                            <div>
                              <h4 className="font-medium mb-2">Documents</h4>
                              <ul className="space-y-2 text-sm">
                                {claim.documents.map((doc: { type: string; url: string }, index: number) => (
                                  <li key={index} className="flex items-center justify-between">
                                    <span className="text-muted-foreground">{doc.type}</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => window.open(doc.url, '_blank')}
                                    >
                                      <FileText className="h-4 w-4" />
                                    </Button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>

                          {claim.status === 'Pending' && (
                            <Alert>
                              <AlertCircle className="h-4 w-4" />
                              <AlertTitle>Claim Under Review</AlertTitle>
                              <AlertDescription>
                                Your claim is currently being processed. You will be notified of any updates.
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Search className="h-8 w-8" />
                      <p>Enter a claim number to track its status</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={viewingDocument !== null} onOpenChange={(open) => !open && setViewingDocument(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-xl font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {viewingDocument?.type}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex flex-col min-h-[60vh]">
            <div className="grid md:grid-cols-[1fr,300px] gap-6 pt-2 flex-1">
              {/* Document Section */}
              <div className="relative bg-gray-50 rounded-lg overflow-hidden border shadow-inner">
                <div className="absolute inset-0 flex items-center justify-center">
                  {isImageLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100/90 backdrop-blur-sm z-10 gap-3">
                      <Loader2 className="h-10 w-10 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground animate-pulse">Loading document...</p>
                    </div>
                  )}
                  {viewingDocument?.url && (
                    <iframe
                      src={viewingDocument.url}
                      className="w-full h-full"
                      title={viewingDocument.type}
                    />
                  )}
                </div>
                <div className="aspect-[3/4] md:aspect-auto md:h-[60vh]" />
              </div>

              {/* Details Section */}
              <div className="space-y-4">
                <div className="rounded-lg border bg-card p-4 shadow-sm">
                  <h3 className="font-semibold mb-4 flex items-center gap-2 text-primary">
                    <FileText className="h-4 w-4" />
                    Document Information
                  </h3>
                  <dl className="space-y-3 text-sm">
                    <div className="grid grid-cols-[100px,1fr] items-center py-1 border-b">
                      <dt className="text-muted-foreground">Type:</dt>
                      <dd className="font-medium">{viewingDocument?.type}</dd>
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
                      onClick={() => window.open(viewingDocument?.url, '_blank')}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Open in New Tab
                    </Button>
                    <Button 
                      className="w-full justify-start" 
                      variant="outline"
                      onClick={() => {
                        const link = document.createElement('a')
                        link.href = viewingDocument?.url || ''
                        link.download = `document-${viewingDocument?.type}`
                        link.click()
                      }}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download Document
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t mt-6 pt-4">
              <Button
                variant="outline"
                onClick={() => setViewingDocument(null)}
                className="px-8"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              Claim Submitted Successfully
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="flex flex-col items-center space-y-4">
              <div className="rounded-full bg-green-50 p-3">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-lg font-semibold">Claim #{submittedClaimDetails?.claimNumber}</p>
                <Badge variant="outline" className="font-medium">
                  {submittedClaimDetails?.status}
                </Badge>
                <p className="text-sm text-gray-500">
                  Please save this claim number for future reference
                </p>
              </div>
              <div className="w-full space-y-3 border rounded-lg p-4 bg-gray-50">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Claimant Name:</span>
                  <span className="font-medium">{submittedClaimDetails?.claimantName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Service Date:</span>
                  <span className="font-medium">{submittedClaimDetails?.serviceDate}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Service Provider:</span>
                  <span className="font-medium">{submittedClaimDetails?.serviceProvider}</span>
                </div>
                </div>
              </div>
              </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuccessDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

