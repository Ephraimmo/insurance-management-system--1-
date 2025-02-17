"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { getClaimDetails } from "@/lib/claims"
import { format } from "date-fns"

// Define the proper types
interface Claim {
  id: string
  contractNumber: string
  claimantName: string
  claimType: string
  claimAmount: number
  claimDate: string
  status: string
  description: string
  documents: string[]
  assessorName?: string
  assessmentDate?: string
  approvalDate?: string
  paymentDate?: string
}

interface ClaimDetails {
  id: string
  contractNumber: string
  claimantName: string
  claimType: string
  claimAmount: number
  claimDate: string
  status: string
  description: string
  documents: string[]
  assessorName?: string
  assessmentDate?: string
  approvalDate?: string
  paymentDate?: string
}

export default function ClaimDetails() {
  const params = useParams()
  const router = useRouter()
  const [claim, setClaim] = useState<Claim | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadClaimDetails() {
      try {
        setLoading(true)
        const claimData = await getClaimDetails(params.id as string)
        // Convert ClaimDetails to Claim if needed
        const claimWithCorrectType: Claim = {
          id: claimData.id,
          contractNumber: claimData.contractNumber,
          claimantName: claimData.claimantName,
          claimType: claimData.claimType,
          claimAmount: claimData.claimAmount,
          claimDate: claimData.claimDate,
          status: claimData.status,
          description: claimData.description,
          documents: claimData.documents,
          assessorName: claimData.assessorName,
          assessmentDate: claimData.assessmentDate,
          approvalDate: claimData.approvalDate,
          paymentDate: claimData.paymentDate,
        }
        setClaim(claimWithCorrectType)
      } catch (error) {
        console.error('Error fetching claim details:', error)
        setError('Failed to load claim details')
      } finally {
        setLoading(false)
      }
    }

    loadClaimDetails()
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
                <p><span className="font-medium">Amount:</span> ${claim.claimAmount.toLocaleString()}</p>
                <p><span className="font-medium">Date Submitted:</span> {format(new Date(claim.claimDate), 'dd/MM/yyyy')}</p>
                <p><span className="font-medium">Status:</span> {claim.status}</p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="whitespace-pre-wrap">{claim.description}</p>
            </div>
          </div>

          {claim.assessorName && (
            <div>
              <h3 className="font-semibold mb-2">Assessor</h3>
              <p>{claim.assessorName}</p>
            </div>
          )}

          {claim.assessmentDate && (
            <div>
              <h3 className="font-semibold mb-2">Assessment Date</h3>
              <p>{format(new Date(claim.assessmentDate), 'dd/MM/yyyy')}</p>
            </div>
          )}

          {claim.documents.length > 0 && (
            <div className="col-span-2">
              <h3 className="font-semibold mb-2">Documents</h3>
              <ul className="list-disc list-inside">
                {claim.documents.map((doc, index) => (
                  <li key={index}>{doc}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 