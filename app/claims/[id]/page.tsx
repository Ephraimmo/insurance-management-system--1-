"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { getClaimDetails } from "@/src/claimFunctions"
import { format } from "date-fns"

type Claim = {
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

export default function ClaimDetails() {
  const params = useParams()
  const router = useRouter()
  const [claim, setClaim] = useState<Claim | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchClaimDetails = async () => {
      try {
        setLoading(true)
        const claimData = await getClaimDetails(params.id as string)
          setClaim(claimData)
      } catch (error) {
        console.error('Error fetching claim details:', error)
        setError('Failed to load claim details')
      } finally {
        setLoading(false)
      }
    }

    if (params.id) {
      fetchClaimDetails()
    }
  }, [params.id])

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

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error || !claim) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              {error || 'Claim not found'}
      </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6">
          <Button
        variant="ghost"
            onClick={() => router.back()}
        className="mb-4"
          >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Claims
          </Button>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Claim Details</CardTitle>
            <Badge className={getStatusColor(claim.status)}>
              {claim.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">Basic Information</h3>
              <div className="space-y-2">
                <p><span className="font-medium">Claim ID:</span> {claim.id}</p>
                <p><span className="font-medium">Contract Number:</span> {claim.contractNumber}</p>
                <p><span className="font-medium">Claimant Name:</span> {claim.claimantName}</p>
                <p><span className="font-medium">Claim Type:</span> {claim.claimType}</p>
                <p><span className="font-medium">Amount:</span> ${claim.amount.toFixed(2)}</p>
                <p><span className="font-medium">Date Submitted:</span> {format(claim.dateSubmitted, 'dd/MM/yyyy')}</p>
                <p><span className="font-medium">Last Updated:</span> {format(claim.lastUpdated, 'dd/MM/yyyy')}</p>
        </div>
      </div>

            {claim.policy && (
              <div>
                <h3 className="font-semibold mb-2">Policy Information</h3>
                <div className="space-y-2">
                  <p><span className="font-medium">Policy Number:</span> {claim.policy.policyNumber}</p>
                  <p><span className="font-medium">Holder Name:</span> {claim.policy.holderName}</p>
                  <p><span className="font-medium">Coverage Amount:</span> ${claim.policy.coverageAmount.toFixed(2)}</p>
                </div>
              </div>
            )}
          </div>

          {claim.deceased && (
            <div>
              <h3 className="font-semibold mb-2">Deceased Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <p><span className="font-medium">Name:</span> {claim.deceased.firstName} {claim.deceased.lastName}</p>
                <p><span className="font-medium">ID Number:</span> {claim.deceased.idNumber}</p>
                <p><span className="font-medium">Date of Death:</span> {claim.deceased.dateOfDeath}</p>
                <p><span className="font-medium">Cause of Death:</span> {claim.deceased.causeOfDeath}</p>
                <p><span className="font-medium">Place of Death:</span> {claim.deceased.placeOfDeath}</p>
                <p><span className="font-medium">Relationship:</span> {claim.deceased.relationship}</p>
              </div>
            </div>
          )}

          {claim.bankDetails && (
            <div>
              <h3 className="font-semibold mb-2">Bank Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <p><span className="font-medium">Account Holder:</span> {claim.bankDetails.accountHolder}</p>
                <p><span className="font-medium">Bank Name:</span> {claim.bankDetails.bankName}</p>
                <p><span className="font-medium">Account Type:</span> {claim.bankDetails.accountType}</p>
                <p><span className="font-medium">Account Number:</span> {claim.bankDetails.accountNumber}</p>
                <p><span className="font-medium">Branch Code:</span> {claim.bankDetails.branchCode}</p>
              </div>
            </div>
          )}

          <div>
            <h3 className="font-semibold mb-2">Description</h3>
            <p className="whitespace-pre-wrap">{claim.description}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 