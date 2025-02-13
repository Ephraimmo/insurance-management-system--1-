import { format } from "date-fns"
import { Loader2, ArrowLeft, Eye, FileText, CheckCircle2, AlertCircle, Download } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Claim } from "@/src/types/claim"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useState } from "react"
import { toast } from "@/components/ui/use-toast"

interface ClaimDetailsViewProps {
  claim: Claim
  onClose: () => void
  onStatusChange: (claimId: string, newStatus: string) => void
  updating: boolean
}

export function ClaimDetailsView({ claim, onClose, onStatusChange, updating }: ClaimDetailsViewProps) {
  const [selectedDocument, setSelectedDocument] = useState<{ type: string; url: string } | null>(null)

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
    const doc = claim.documents?.find((d: { type: string; url: string }) => d.type === docType)
    if (doc) {
      setSelectedDocument(doc)
    }
  }

  const handleDownload = async (docType: string) => {
    const doc = claim.documents?.find((d: { type: string; url: string }) => d.type === docType)
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
              <CardTitle>Claim Details - {claim.id}</CardTitle>
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">Contract Number:</span> {claim.contractNumber}
                {claim.claimNumber && (
                  <span className="ml-4">
                    <span className="font-medium">Claim Number:</span> {claim.claimNumber}
                  </span>
                )}
              </div>
            </div>
            <Badge className={getStatusColor(claim.status)}>
              {updating ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Updating...
                </div>
              ) : (
                claim.status
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="claim" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="claim">Claim Details</TabsTrigger>
              <TabsTrigger value="deceased">Deceased Details</TabsTrigger>
              <TabsTrigger value="bank">Bank Details</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </TabsList>

            <div className="mt-4 border rounded-md p-4">
              <TabsContent value="claim">
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Claimant Name</TableCell>
                      <TableCell>{claim.claimantName}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Last Updated</TableCell>
                      <TableCell>{formatDate(claim.lastUpdated)}</TableCell>
                    </TableRow>
                    {claim.policy && (
                      <>
                        <TableRow>
                          <TableCell className="font-medium">Policy Number</TableCell>
                          <TableCell>{claim.policy.policyNumber}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Policy Holder</TableCell>
                          <TableCell>{claim.policy.holderName}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Coverage Amount</TableCell>
                          <TableCell>${claim.policy.coverageAmount?.toFixed(2) || '0.00'}</TableCell>
                        </TableRow>
                      </>
                    )}
                  </TableBody>
                </Table>
              </TabsContent>

              {claim.deceased && (
                <TabsContent value="deceased">
                  <Table>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">Full Name</TableCell>
                        <TableCell>{claim.deceased.firstName} {claim.deceased.lastName}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">ID Number</TableCell>
                        <TableCell>{claim.deceased.idNumber}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Date of Death</TableCell>
                        <TableCell>{claim.deceased.dateOfDeath}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Cause of Death</TableCell>
                        <TableCell>{claim.deceased.causeOfDeath}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Place of Death</TableCell>
                        <TableCell>{claim.deceased.placeOfDeath}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Relationship</TableCell>
                        <TableCell>{claim.deceased.relationship}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TabsContent>
              )}

              {claim.bankDetails && (
                <TabsContent value="bank">
                  <Table>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">Account Holder</TableCell>
                        <TableCell>{claim.bankDetails.accountHolder}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Bank Name</TableCell>
                        <TableCell>{claim.bankDetails.bankName}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Account Type</TableCell>
                        <TableCell>{claim.bankDetails.accountType}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Account Number</TableCell>
                        <TableCell>{claim.bankDetails.accountNumber}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Branch Code</TableCell>
                        <TableCell>{claim.bankDetails.branchCode}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TabsContent>
              )}

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
                              {claim.documents?.some((doc: { type: string; url: string }) => doc.type === docType) ? (
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
                              {claim.documents?.some((doc: { type: string; url: string }) => doc.type === docType) ? (
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
            </div>
          </Tabs>

          <div className="flex justify-between items-center gap-4 mt-4 pt-4 border-t">
            <Select
              value={claim.status}
              onValueChange={(value) => onStatusChange(claim.id, value)}
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