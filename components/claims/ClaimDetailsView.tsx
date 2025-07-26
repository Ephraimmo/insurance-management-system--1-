import { format } from "date-fns"
import { Loader2, ArrowLeft, Eye, FileText, CheckCircle2, AlertCircle, Download } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Claim } from "@/src/types/claim"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useState, useEffect } from "react"
import { toast } from "@/components/ui/use-toast"
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore"
import { db } from "@/src/FirebaseConfg"

// Add interface for full claim data
interface FullClaimData {
  id: string;
  contractNumber: string;
  claimNumber?: string;
  status: string;
  claimantName: string;
  relationship: string;
  serviceDate: string;
  serviceProvider: string;
  location: string;
  lastUpdated: Date | null;
  createdAt?: Date | null;
  policy: {
    policyNumber: string;
    holderName: string;
    coverageAmount: number;
  } | null;
  deceased: any | null;
  bankDetails: any[];
  documents: Array<{ type: string; url: string }>;
}

interface ClaimDetailsViewProps {
  claim: {
    id: string
    claimNumber?: string
    status?: string
  }
  onClose: () => void
  onStatusChange: (claimId: string, newStatus: string) => void
  updating: boolean
}

export function ClaimDetailsView({ claim, onClose, onStatusChange, updating }: ClaimDetailsViewProps) {
  const [selectedDocument, setSelectedDocument] = useState<{ type: string; url: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusUpdated, setStatusUpdated] = useState(false)
  const [fullClaimData, setFullClaimData] = useState<FullClaimData>({
    id: "",
    contractNumber: "",
    claimNumber: "",
    status: "",
    claimantName: "",
    relationship: "",
    serviceDate: "",
    serviceProvider: "",
    location: "",
    lastUpdated: null,
    policy: null,
    deceased: null,
    bankDetails: [],
    documents: []
  })

  // Fetch all claim data from various collections
  useEffect(() => {
    // Skip re-fetching if this is just a status update
    if (statusUpdated) {
      setStatusUpdated(false);
      return;
    }

    // Define fetchClaimData function
    const fetchClaimData = async () => {
      try {
        console.log("ClaimDetailsView received claim:", claim);
        setIsLoading(true);
        setError(null);
        
        // Validate claim object
        if (!claim) {
          throw new Error("No claim data provided");
        }
        
        // Get the claim ID from the prop - this is what was clicked on
        const claimId = claim.id || claim.claimNumber;
        
        if (!claimId) {
          console.error("Claim object has no ID:", claim);
          throw new Error("Claim ID not found in the provided data");
        }
        
        console.log("Fetching claim data for ID:", claimId);
        
        // 1. First try to get the claim directly using the ID
        const directClaimRef = doc(db, 'Claims', claimId);
        const directClaimSnap = await getDoc(directClaimRef);
        
        if (directClaimSnap.exists()) {
          // Use direct document approach
          const claimData = directClaimSnap.data();
          const lookupId = claimId;
          
          console.log("Found claim data:", claimData);
          
          // Get related data
          await fetchRelatedData(lookupId, claimData, directClaimSnap.id);
        } else {
          // Try using claim number as fallback
          const claimsRef = collection(db, 'Claims');
          const claimQuery = query(claimsRef, where("claimNumber", "==", claimId));
          const claimSnap = await getDocs(claimQuery);
          
          if (!claimSnap.empty) {
            const claimDoc = claimSnap.docs[0];
            const claimData = claimDoc.data();
            console.log("Found claim via claimNumber query:", claimData);
            await fetchRelatedData(claimId, claimData, claimDoc.id);
          } else {
            console.error("No claim document found with ID:", claimId);
            throw new Error(`Claim not found in database (ID: ${claimId})`);
          }
        }
      } catch (error) {
        console.error("Error fetching claim data:", error);
        setError(error instanceof Error ? error.message : "Failed to load claim data");
      } finally {
        setIsLoading(false);
      }
    };

    // Helper function to fetch related claim data
    const fetchRelatedData = async (
      lookupId: string, 
      claimData: any, 
      documentId: string
    ) => {
      // 2. Fetch policy details
      let policyData = null
      const policyRef = doc(db, 'ClaimPolicies', lookupId)
      const policySnap = await getDoc(policyRef)
      if (policySnap.exists()) {
        policyData = policySnap.data()
      }
      
      // 3. Fetch deceased details
      let deceasedData = null
      const deceasedRef = doc(db, 'ClaimDeceased', lookupId)
      const deceasedSnap = await getDoc(deceasedRef)
      if (deceasedSnap.exists()) {
        deceasedData = deceasedSnap.data()
      }
      
      // 4. Get bank details directly from the main claim document
      let bankDetailsArray = []
      
      // New primary approach: Check if bank details are in the main claim document as an array
      if (claimData.bankDetails && Array.isArray(claimData.bankDetails)) {
        // If bank details are directly in the claim document as an array
        bankDetailsArray = claimData.bankDetails.map((detail: any, index: number) => ({
          id: index.toString(),
          ...detail
        }))
      } else {
        // Fallback approaches
        
        // Check if there's a subcollection for bank details
        const bankDetailsCollectionRef = collection(db, 'Claims', documentId, 'bankDetails')
        const bankDetailsQuery = query(bankDetailsCollectionRef)
        const bankDetailsSnap = await getDocs(bankDetailsQuery)
        
        if (!bankDetailsSnap.empty) {
          // Bank details as subcollection
          bankDetailsArray = bankDetailsSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
        } else {
          // Check ClaimBankDetails collection - bank details are stored as an array field
          const singleBankRef = doc(db, 'ClaimBankDetails', lookupId)
          const singleBankSnap = await getDoc(singleBankRef)
          
          if (singleBankSnap.exists()) {
            const bankData = singleBankSnap.data()
            
            // Check if bankDetails field exists and is an array
            if (bankData.bankDetails && Array.isArray(bankData.bankDetails)) {
              bankDetailsArray = bankData.bankDetails.map((detail: any, index: number) => ({
                id: index.toString(),
                ...detail
              }))
            } 
            // Legacy approach - check if the document itself has bank details
            else if (bankData.bankName && bankData.accountNumber) {
              bankDetailsArray = [{ id: 'legacy', ...bankData }]
            }
          }
        }
      }
      
      // 5. Fetch documents
      let documentsData = []
      const documentsRef = doc(db, 'ClaimDocuments', lookupId)
      const documentsSnap = await getDoc(documentsRef)
      if (documentsSnap.exists() && documentsSnap.data()?.documents) {
        documentsData = documentsSnap.data()?.documents || []
      }
      
      // Combine all data
      setFullClaimData({
        id: documentId,
        claimNumber: claimData.claimNumber,
        contractNumber: claimData.contractNumber,
        status: claimData.status,
        claimantName: claimData.claimantName,
        relationship: claimData.relationship,
        serviceDate: claimData.serviceDate,
        serviceProvider: claimData.serviceProvider,
        location: claimData.location,
        lastUpdated: claimData.updatedAt?.toDate(),
        createdAt: claimData.createdAt?.toDate(),
        policy: policyData ? {
          policyNumber: policyData.policyNumber,
          holderName: policyData.holderName,
          coverageAmount: policyData.coverageAmount
        } : null,
        deceased: deceasedData,
        bankDetails: bankDetailsArray,
        documents: documentsData
      })
    }

    // Only run the effect if a valid claim object exists
    if (claim) {
      fetchClaimData();
    } else {
      console.error("No claim provided to ClaimDetailsView");
      setError("No claim information provided");
      setIsLoading(false);
    }
  }, [claim]);

  // Handle updates from parent component (especially status changes)
  useEffect(() => {
    // This effect is specifically for handling parent component updates to the claim
    // We check if the parent component has provided a new selectedClaim
    if (claim && !isLoading && fullClaimData.id) {
      // Skip if we've just updated the status ourselves
      if (!statusUpdated && claim.id === fullClaimData.id) {
        console.log("Detected potential update from parent for claim:", claim.id);
        // Refresh status if needed from parent (no refetching)
        const parentClaimStatus = (claim as any).status;
        if (parentClaimStatus && parentClaimStatus !== fullClaimData.status) {
          console.log("Updating status from parent:", parentClaimStatus);
          setFullClaimData(prev => ({
            ...prev,
            status: parentClaimStatus || prev.status
          }));
        }
      }
    }
  }, [claim, isLoading, statusUpdated, fullClaimData.id]);

  const getStatusColor = (status: string) => {
    if (!status) return 'bg-gray-100 text-gray-800'
    
    switch (status.toLowerCase()) {
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      case 'under investigation':
        return 'bg-yellow-100 text-yellow-800'
      case 'paid':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (date: any) => {
    try {
      if (!date) return 'N/A'
      return format(new Date(date), 'dd/MM/yyyy HH:mm:ss')
    } catch {
      return 'Invalid Date'
    }
  }

  const handleViewDocument = (docType: string) => {
    const doc = fullClaimData.documents?.find((d: { type: string; url: string }) => d.type === docType)
    if (doc) {
      setSelectedDocument(doc)
    }
  }

  const handleDownload = async (docType: string) => {
    const doc = fullClaimData.documents?.find((d: { type: string; url: string }) => d.type === docType)
    if (doc?.url) {
      try {
        const response = await fetch(doc.url)
        if (!response.ok) throw new Error('Download failed')
        
        const blob = await response.blob()
        const fileName = `${docType.toLowerCase().replace(/\s+/g, '_')}.pdf`
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.style.display = 'none'
        link.href = url
        link.download = fileName
        
        document.body.appendChild(link)
        link.click()
        
        setTimeout(() => {
          document.body.removeChild(link)
          window.URL.revokeObjectURL(url)
        }, 100)
      } catch (error) {
        console.error('Error downloading document:', error)
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to download document. Please try again."
        })
      }
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading claim details...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          onClick={onClose}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Claims
        </Button>
        
        <Card className="p-6">
          <div className="flex items-center space-x-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <p className="font-medium">{error}</p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        onClick={onClose}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Claims
      </Button>
    
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <CardTitle>Claim Details - {fullClaimData.id}</CardTitle>
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">Contract Number:</span> {fullClaimData.contractNumber}
                {fullClaimData.claimNumber && (
                  <span className="ml-4">
                    <span className="font-medium">Claim Number:</span> {fullClaimData.claimNumber}
                  </span>
                )}
              </div>
            </div>
            <Badge className={getStatusColor(fullClaimData.status)}>
              {updating ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Updating...
                </div>
              ) : (
                fullClaimData.status
              )}
            </Badge>
          </div>
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

            <div className="mt-4 border rounded-md p-4">
              <TabsContent value="policy">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Contract Number</TableHead>
                      <TableHead>Policy Holder</TableHead>
                      <TableHead>Cover Amount</TableHead>
                      <TableHead>Policy Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>{fullClaimData.contractNumber || 'N/A'}</TableCell>
                      <TableCell>{fullClaimData.policy?.holderName || 'N/A'}</TableCell>
                      <TableCell>R{fullClaimData.policy?.coverageAmount?.toFixed(2) || '0.00'}</TableCell>
                      <TableCell>{fullClaimData.status || 'Active'}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TabsContent>

                <TabsContent value="deceased">
                {fullClaimData.deceased ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Full Name</TableHead>
                        <TableHead>ID Number</TableHead>
                        <TableHead>Date of Death</TableHead>
                        <TableHead>Cause of Death</TableHead>
                        <TableHead>Place of Death</TableHead>
                        <TableHead>Relationship</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>{fullClaimData.deceased.firstName} {fullClaimData.deceased.lastName}</TableCell>
                        <TableCell>{fullClaimData.deceased.idNumber}</TableCell>
                        <TableCell>{fullClaimData.deceased.dateOfDeath}</TableCell>
                        <TableCell>{fullClaimData.deceased.causeOfDeath}</TableCell>
                        <TableCell>{fullClaimData.deceased.placeOfDeath}</TableCell>
                        <TableCell>{fullClaimData.deceased.relationship}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                ) : (
                  <div className="py-3 text-center text-muted-foreground">No deceased information available</div>
                )}
                </TabsContent>

                <TabsContent value="bank">
                {fullClaimData.bankDetails && fullClaimData.bankDetails.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Holder</TableHead>
                        <TableHead>Bank</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Number</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Statement</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fullClaimData.bankDetails.map((bankDetail: any, index: number) => (
                        <TableRow key={bankDetail.id || index}>
                          <TableCell>{bankDetail.accountHolder}</TableCell>
                          <TableCell>{bankDetail.bankName}</TableCell>
                          <TableCell>{bankDetail.accountType}</TableCell>
                          <TableCell>{bankDetail.accountNumber}</TableCell>
                          <TableCell>{bankDetail.branchCode}</TableCell>
                          <TableCell>
                            {(bankDetail.statementUrl || fullClaimData.documents?.some(
                              (doc: { type: string; url: string }) => doc.type === 'Bank Statement')
                            ) ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  // First try the direct URL if available
                                  if (bankDetail.statementUrl) {
                                    setSelectedDocument({
                                      type: 'Bank Statement',
                                      url: bankDetail.statementUrl
                                    })
                                  } else {
                                    // Otherwise try to find it in documents
                                    handleViewDocument('Bank Statement')
                                  }
                                }}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </Button>
                            ) : (
                              <span className="text-yellow-500">Not uploaded</span>
                            )}
                          </TableCell>
                      </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="py-3 text-center text-muted-foreground">No bank details available</div>
                )}
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
                              {fullClaimData.documents?.some((doc: { type: string; url: string }) => doc.type === docType) ? (
                                <div className="flex items-center gap-4">
                                  <div className="flex items-center gap-2 text-green-500">
                                    <CheckCircle2 className="h-4 w-4" />
                                    <span>Uploaded</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleViewDocument(docType)}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDownload(docType)}
                                    >
                                      <Download className="h-4 w-4" />
                                    </Button>
                                  </div>
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
                              {fullClaimData.documents?.some((doc: { type: string; url: string }) => doc.type === docType) ? (
                                <div className="flex items-center gap-4">
                                  <div className="flex items-center gap-2 text-green-500">
                                    <CheckCircle2 className="h-4 w-4" />
                                    <span>Uploaded</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleViewDocument(docType)}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDownload(docType)}
                                    >
                                      <Download className="h-4 w-4" />
                                    </Button>
                                  </div>
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
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Claim Number</TableHead>
                      <TableHead>Service Date</TableHead>
                      <TableHead>Service Provider</TableHead>
                      <TableHead>Location</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>{fullClaimData.claimNumber || fullClaimData.id}</TableCell>
                      <TableCell>{fullClaimData.serviceDate || 'N/A'}</TableCell>
                      <TableCell>{fullClaimData.serviceProvider || 'N/A'}</TableCell>
                      <TableCell>{fullClaimData.location || 'N/A'}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TabsContent>
            </div>
          </Tabs>

          <div className="flex justify-between items-center gap-4 mt-4 pt-4 border-t">
            <Select
              value={fullClaimData.status}
              onValueChange={(value) => {
                console.log("Status dropdown changed to:", value);
                
                // Update local state immediately
                setFullClaimData((prev: FullClaimData) => ({
                  ...prev,
                  status: value
                }));
                // Mark that we've updated status locally
                setStatusUpdated(true);
                // Then call the parent handler
                onStatusChange(fullClaimData.id, value);
              }}
              disabled={updating}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={updating ? "Updating..." : "Select status"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FNOL">FNOL</SelectItem>
                <SelectItem value="under investigation">Under Investigation</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedDocument} onOpenChange={() => setSelectedDocument(null)}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>{selectedDocument?.type}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 h-full">
            <iframe 
              src={selectedDocument?.url} 
              className="w-full h-full rounded-md"
              title={selectedDocument?.type}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
} 