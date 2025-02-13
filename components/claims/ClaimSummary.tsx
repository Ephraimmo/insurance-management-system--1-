import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { format } from "date-fns"
import { FileImage } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type ClaimSummaryProps = {
  claim: {
    id: string
    contractNumber: string
    claimantName: string
    claimType: string
    status: string
    amount: number
    description: string
    dateSubmitted: Date
    lastUpdated: Date
    documents?: string[]
    relationship: string
    serviceDate: string
    serviceProvider: string
    location: string
    policy: {
      policyNumber: string
      holderName: string
      coverageAmount: number
    } | null
    deceased?: {
      firstName: string
      lastName: string
      idNumber: string
      dateOfDeath: string
      causeOfDeath: string
      placeOfDeath: string
      relationship: string
    } | null
    bankDetails?: {
      accountHolder: string
      bankName: string
      accountType: string
      accountNumber: string
      branchCode: string
    } | null
  }
  onStatusChange: (status: string) => void
  onClose: () => void
  updating: boolean
}

export function ClaimSummary({ claim, onStatusChange, onClose, updating }: ClaimSummaryProps) {
  const getStatusColor = (status: string) => {
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Claim Summary - {claim.id}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Basic Claim Information */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contract Number</Label>
                <div className="font-medium">{claim.contractNumber}</div>
              </div>
              <div className="space-y-2">
                <Label>Claimant Name</Label>
                <div className="font-medium">{claim.claimantName}</div>
              </div>
              <div className="space-y-2">
                <Label>Service Provider</Label>
                <div className="font-medium">{claim.serviceProvider}</div>
              </div>
              <div className="space-y-2">
                <Label>Service Date</Label>
                <div className="font-medium">{claim.serviceDate}</div>
              </div>
              <div className="space-y-2">
                <Label>Relationship</Label>
                <div className="font-medium">{claim.relationship}</div>
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <div className="font-medium">{claim.location}</div>
              </div>
              <div className="space-y-2">
                <Label>Date Submitted</Label>
                <div className="font-medium">{format(claim.dateSubmitted, 'dd/MM/yyyy HH:mm')}</div>
              </div>
              <div className="space-y-2">
                <Label>Last Updated</Label>
                <div className="font-medium">{format(claim.lastUpdated, 'dd/MM/yyyy HH:mm')}</div>
              </div>
            </div>

            {/* Policy Details */}
            {claim.policy && (
              <div className="pt-4 border-t">
                <h3 className="font-semibold mb-3">Policy Details</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Policy Number</Label>
                    <div className="font-medium">{claim.policy.policyNumber}</div>
                  </div>
                  <div className="space-y-2">
                    <Label>Policy Holder</Label>
                    <div className="font-medium">{claim.policy.holderName}</div>
                  </div>
                  <div className="space-y-2">
                    <Label>Coverage Amount</Label>
                    <div className="font-medium">R{claim.policy.coverageAmount.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Deceased Information */}
            {claim.deceased && (
              <div className="pt-4 border-t">
                <h3 className="font-semibold mb-3">Deceased Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <div className="font-medium">{claim.deceased.firstName} {claim.deceased.lastName}</div>
                  </div>
                  <div className="space-y-2">
                    <Label>ID Number</Label>
                    <div className="font-medium">{claim.deceased.idNumber}</div>
                  </div>
                  <div className="space-y-2">
                    <Label>Date of Death</Label>
                    <div className="font-medium">{claim.deceased.dateOfDeath}</div>
                  </div>
                  <div className="space-y-2">
                    <Label>Cause of Death</Label>
                    <div className="font-medium">{claim.deceased.causeOfDeath}</div>
                  </div>
                  <div className="space-y-2">
                    <Label>Place of Death</Label>
                    <div className="font-medium">{claim.deceased.placeOfDeath}</div>
                  </div>
                  <div className="space-y-2">
                    <Label>Relationship</Label>
                    <div className="font-medium">{claim.deceased.relationship}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Bank Details */}
            {claim.bankDetails && (
              <div className="pt-4 border-t">
                <h3 className="font-semibold mb-3">Bank Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Account Holder</Label>
                    <div className="font-medium">{claim.bankDetails.accountHolder}</div>
                  </div>
                  <div className="space-y-2">
                    <Label>Bank Name</Label>
                    <div className="font-medium">{claim.bankDetails.bankName}</div>
                  </div>
                  <div className="space-y-2">
                    <Label>Account Type</Label>
                    <div className="font-medium">{claim.bankDetails.accountType}</div>
                  </div>
                  <div className="space-y-2">
                    <Label>Account Number</Label>
                    <div className="font-medium">{claim.bankDetails.accountNumber}</div>
                  </div>
                  <div className="space-y-2">
                    <Label>Branch Code</Label>
                    <div className="font-medium">{claim.bankDetails.branchCode}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Documents */}
            {claim.documents && claim.documents.length > 0 && (
              <div className="pt-4 border-t">
                <h3 className="font-semibold mb-3">Attached Documents</h3>
                <div className="grid grid-cols-2 gap-2">
                  {claim.documents.map((doc, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      className="justify-start"
                      onClick={() => window.open(doc, '_blank')}
                    >
                      <FileImage className="mr-2 h-4 w-4" />
                      Document {index + 1}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Status and Actions */}
            <div className="flex justify-between items-center pt-4 border-t">
              <div className="space-y-2">
                <Label>Current Status</Label>
                <div>
                  <Badge className={getStatusColor(claim.status)}>
                    {claim.status}
                  </Badge>
                </div>
              </div>
              <div className="space-x-2">
                <Button variant="outline" onClick={onClose}>
                  Close
                </Button>
                <Select
                  value={claim.status}
                  onValueChange={onStatusChange}
                  disabled={updating}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Update status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Under Investigation">Under Investigation</SelectItem>
                    <SelectItem value="Approved">Approved</SelectItem>
                    <SelectItem value="Rejected">Rejected</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 