"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, Search, AlertCircle, X, ChevronLeft, ChevronRight, ArrowUpDown, FileImage, ArrowLeft, Plus } from "lucide-react"
import { collection, query, where, orderBy, startAfter, limit, getDocs, doc, updateDoc, getDoc } from "firebase/firestore"
import { db } from "@/src/FirebaseConfg"
import { format } from "date-fns"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/components/ui/use-toast"
import { getClaimDetails, getAllClaimDetails } from "@/src/claimFunctions"
import { SearchFilter } from "@/components/claims/SearchFilter"
import { ClaimSummary } from "./claims/ClaimSummary"
import { ClaimDetailsView } from "./claims/ClaimDetailsView"
import { Claim } from "../src/types/claim"

type SearchParams = {
  contractNumber: string
  claimId: string
  dateFrom: string
  dateTo: string
  status: string
  claimantName: string
  claimType: string
}

type SortConfig = {
  field: 'dateSubmitted' | 'lastUpdated' | 'status' | 'claimantName' | 'contractNumber' | 'claimNumber'
  direction: 'asc' | 'desc'
}

const PAGE_SIZE = 10

interface ClaimsProcessingProps {
  userRole?: string
}

export function ClaimsProcessing({ userRole }: ClaimsProcessingProps) {
  const canEdit = userRole && userRole !== 'View Only'

  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useState<SearchParams>({
    contractNumber: "",
    claimId: "",
    dateFrom: "",
    dateTo: "",
    status: "all",
    claimantName: "",
    claimType: "all"
  })
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'dateSubmitted', direction: 'desc' })
  const [lastVisible, setLastVisible] = useState<any>(null)
  const [hasMore, setHasMore] = useState(true)
  const [updating, setUpdating] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetchClaims()
  }, [searchParams, sortConfig])

  const fetchClaims = async (loadMore = false) => {
    try {
      setLoading(true)
      setError(null)

      const claimsData = await getAllClaimDetails(searchParams, sortConfig, loadMore ? lastVisible : null, PAGE_SIZE)
      
      setLastVisible(claimsData.lastVisible)
      setHasMore(claimsData.hasMore)

      const transformedClaims = claimsData.claims.map(transformClaimData)
      
      if (loadMore) {
        setClaims(prev => [...prev, ...transformedClaims])
      } else {
        setClaims(transformedClaims)
      }
    } catch (error) {
      console.error('Error fetching claims:', error)
      setError('Failed to load claims. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (claimId: string, newStatus: string) => {
    if (!canEdit) return // Prevent status changes for view-only users
    
    try {
      setUpdating(true)
      const claimRef = doc(db, 'Claims', claimId)
      await updateDoc(claimRef, {
        status: newStatus,
        lastUpdated: new Date()
      })

      setClaims(prev => prev.map(claim => 
        claim.id === claimId 
          ? transformClaimData({ ...claim, status: newStatus, lastUpdated: new Date() })
          : claim
      ))

      toast({
        title: "Success",
        description: "Claim status updated successfully"
      })
    } catch (error) {
      console.error('Error updating claim status:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update claim status"
      })
    } finally {
      setUpdating(false)
    }
  }

  const transformClaimData = (data: any): Claim => ({
    ...data,
    id: data.id,
    claimNumber: data.claimNumber || data.id,
    contractNumber: data.contractNumber,
    claimantName: data.claimantName,
    claimType: data.claimType,
    status: data.status,
    amount: data.amount,
    description: data.description,
    dateSubmitted: data.dateSubmitted?.toDate?.() || new Date(data.dateSubmitted),
    lastUpdated: data.lastUpdated?.toDate?.() || new Date(data.lastUpdated),
    documents: data.documents?.map((doc: any) => ({
      type: doc.type,
      url: doc.url
    })),
    relationship: data.relationship,
    serviceDate: data.serviceDate,
    serviceProvider: data.serviceProvider,
    location: data.location,
    policy: data.policy,
    deceased: data.deceased,
    bankDetails: data.bankDetails
  })

  const handleViewClaim = async (claimId: string) => {
    try {
      setLoading(true)
      const claimData = await getClaimDetails(claimId)
      if (claimData) {
        setSelectedClaim(transformClaimData(claimData))
      }
    } catch (error) {
      console.error('Error fetching claim details:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load claim details"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSort = (field: SortConfig['field']) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
    setLastVisible(null)
  }

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

  return (
    <div className="space-y-6">
      {!selectedClaim && (
        <>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1">
              <Input
                placeholder="Search by claim number or contract number"
                value={searchParams.claimId || searchParams.contractNumber}
                onChange={(e) => {
                  const value = e.target.value
                  setSearchParams(prev => ({
                    ...prev,
                    claimId: value,
                    contractNumber: value
                  }))
                }}
              />
            </div>
            <Button 
              variant="outline" 
              onClick={() => fetchClaims()}
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
                  Search
                </>
              )}
            </Button>
          </div>
          <SearchFilter 
            searchParams={searchParams} 
            setSearchParams={setSearchParams} 
          />
        </>
      )}

      {!selectedClaim ? (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Claims List</CardTitle>
              <div className="flex gap-4">
                {['FNOL', 'under investigation', 'approved', 'paid', 'rejected'].map(status => (
                  <Badge key={status} className={getStatusColor(status)}>
                    {status.toUpperCase()}: {claims.filter(claim => claim.status.toLowerCase() === status.toLowerCase()).length}
                  </Badge>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <div className="flex items-center gap-2">
                      Claim ID
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('contractNumber')}>
                    <div className="flex items-center gap-2">
                      Contract Number
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('claimantName')}>
                    <div className="flex items-center gap-2">
                      Claimant Name
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('dateSubmitted')}>
                    <div className="flex items-center gap-2">
                      Date Submitted
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('status')}>
                    <div className="flex items-center gap-2">
                      Status
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <div className="flex justify-center">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : claims.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <AlertCircle className="h-8 w-8" />
                        <p>No claims found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  claims.map((claim) => (
                  <TableRow key={claim.id}>
                      <TableCell>
                        <Button
                          variant="link"
                          onClick={() => handleViewClaim(claim.id)}
                          className="p-0 h-auto font-medium"
                        >
                          {claim.id}
                        </Button>
                      </TableCell>
                    <TableCell>{claim.contractNumber}</TableCell>
                    <TableCell>{claim.claimantName}</TableCell>
                      <TableCell>{format(claim.dateSubmitted, 'dd/MM/yyyy')}</TableCell>
                    <TableCell>
                        <Badge className={getStatusColor(claim.status)}>
                          {claim.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {hasMore && !loading && (
              <div className="flex justify-center mt-4">
                <Button
                  variant="outline"
                  onClick={() => fetchClaims(true)}
                  className="flex items-center gap-2"
                >
                  Load More Claims
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <ClaimDetailsView
          claim={selectedClaim}
          onClose={() => setSelectedClaim(null)}
          onStatusChange={handleStatusChange}
          updating={updating}
        />
      )}
    </div>
  )
}

