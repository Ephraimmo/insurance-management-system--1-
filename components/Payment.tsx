import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, Plus, Search, Pencil, Trash2, X, AlertCircle, Upload, Image, FileImage, Download, Eye } from "lucide-react"
import { collection, getDocs, query, orderBy, doc, setDoc, deleteDoc, where, limit, getDoc } from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage"
import { db, storage } from "@/src/FirebaseConfg"
import { toast } from "@/components/ui/use-toast"
import { format } from "date-fns"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"

type Payment = {
  id: string
  contractNumber: string
  amount: number
  paymentDate: Date
  paymentMethod: string
  status: string
  reference: string
  receiptUrl?: string
}

type SearchParams = {
  contractNumber: string
  reference: string
  date: string
  status: string
}

export function Payment() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [searchParams, setSearchParams] = useState<SearchParams>({
    contractNumber: "",
    reference: "",
    date: "",
    status: "all"
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)
  const [formData, setFormData] = useState({
    contractNumber: "",
    amount: "",
    paymentMethod: "",
    reference: "",
    receiptUrl: ""
  })
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [viewingReceipt, setViewingReceipt] = useState<{ url: string; reference: string } | null>(null)
  const [isImageLoading, setIsImageLoading] = useState(false)
  const [contractDetails, setContractDetails] = useState<{
    policyAmount: number
    cateringTotal: number
    totalAmount: number
    mainMemberName: string
  } | null>(null)
  const [isLookingUp, setIsLookingUp] = useState(false)

  useEffect(() => {
    fetchPayments()
  }, [])

  const fetchPayments = async () => {
    try {
      setIsLoading(true)
      const paymentQuery = query(collection(db, 'Payments'), orderBy('paymentDate', 'desc'))
      const querySnapshot = await getDocs(paymentQuery)
      const paymentList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        contractNumber: doc.data().contractNumber,
        amount: doc.data().amount,
        paymentMethod: doc.data().paymentMethod,
        status: doc.data().status,
        reference: doc.data().reference,
        receiptUrl: doc.data().receiptUrl,
        paymentDate: doc.data().paymentDate?.toDate() || new Date()
      })) as Payment[]
      setPayments(paymentList)
    } catch (error) {
      console.error('Error fetching payments:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load payments"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const validateContract = async (contractNumber: string) => {
    try {
      const contractQuery = query(
        collection(db, 'Contracts'),
        where('contractNumber', '==', contractNumber)
      )
      const querySnapshot = await getDocs(contractQuery)
      return !querySnapshot.empty
    } catch (error) {
      console.error('Error validating contract:', error)
      return false
    }
  }

  const handleFileUpload = async (file: File) => {
    try {
      setUploadingReceipt(true)
      
      const timestamp = Date.now()
      const fileName = `receipts/${timestamp}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
      
      const fileRef = ref(storage, fileName)
      
      await uploadBytes(fileRef, file)
      
      const downloadUrl = await getDownloadURL(fileRef)
      
      const objectUrl = URL.createObjectURL(file)
      setPreviewUrl(objectUrl)
      
      setFormData(prev => ({ ...prev, receiptUrl: downloadUrl }))
      
      toast({
        title: "Success",
        description: "Receipt uploaded successfully"
      })
    } catch (error) {
      console.error('Error uploading receipt:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to upload receipt"
      })
    } finally {
      setUploadingReceipt(false)
    }
  }

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const generateReference = async () => {
    try {
      // Get the latest reference number
      const paymentsRef = collection(db, 'Payments')
      const q = query(paymentsRef, orderBy('reference', 'desc'), limit(1))
      const querySnapshot = await getDocs(q)
      
      let nextNumber = 1
      if (!querySnapshot.empty) {
        const latestRef = querySnapshot.docs[0].data().reference
        const matches = latestRef.match(/ref-(\d+)/)
        if (matches) {
          nextNumber = parseInt(matches[1]) + 1
        }
      }
      
      // Format the new reference number with leading zeros
      return `ref-${String(nextNumber).padStart(10, '0')}`
    } catch (error) {
      console.error('Error generating reference:', error)
      throw new Error('Failed to generate reference number')
    }
  }

  const checkDuplicateReference = async (reference: string) => {
    const paymentsRef = collection(db, 'Payments')
    const q = query(paymentsRef, where('reference', '==', reference))
    const querySnapshot = await getDocs(q)
    return !querySnapshot.empty
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.contractNumber.trim() || !formData.amount || !formData.paymentMethod || !formData.receiptUrl) {
      setError("All fields are required, including receipt image")
      return
    }

    const isValidContract = await validateContract(formData.contractNumber)
    if (!isValidContract) {
      setError("Invalid contract number")
      return
    }

    try {
      setIsSaving(true)
      
      // Generate new reference if not editing
      let reference = formData.reference
      if (!editingPayment) {
        reference = await generateReference()
        
        // Double-check for duplicates
        const isDuplicate = await checkDuplicateReference(reference)
        if (isDuplicate) {
          setError("Duplicate reference number detected. Please try again.")
          return
        }
      }

      const timestamp = new Date()
      const paymentData = {
        contractNumber: formData.contractNumber,
        amount: parseFloat(formData.amount),
        paymentDate: timestamp,
        paymentMethod: formData.paymentMethod,
        status: "Completed",
        reference: reference,
        receiptUrl: formData.receiptUrl
      }

      if (editingPayment) {
        if (editingPayment.receiptUrl && editingPayment.receiptUrl !== formData.receiptUrl) {
          try {
            const oldReceiptRef = ref(storage, editingPayment.receiptUrl)
            await deleteObject(oldReceiptRef)
          } catch (error) {
            console.error('Error deleting old receipt:', error)
          }
        }
        await setDoc(doc(db, 'Payments', editingPayment.id), paymentData)
        toast({
          title: "Success",
          description: "Payment updated successfully"
        })
      } else {
        const newId = `PAY${String(payments.length + 1).padStart(3, '0')}`
        await setDoc(doc(db, 'Payments', newId), {
          ...paymentData,
          id: newId
        })
        toast({
          title: "Success",
          description: "Payment added successfully"
        })
      }

      setFormData({
        contractNumber: "",
        amount: "",
        paymentMethod: "",
        reference: "",
        receiptUrl: ""
      })
      setPreviewUrl(null)
      setEditingPayment(null)
      setIsDialogOpen(false)
      fetchPayments()
    } catch (error) {
      console.error('Error saving payment:', error)
      setError("Failed to save payment")
    } finally {
      setIsSaving(false)
    }
  }

  const handleSearchChange = (field: keyof SearchParams, value: string) => {
    setSearchParams(prev => ({ ...prev, [field]: value }))
  }

  const clearSearch = () => {
    setSearchParams({
      contractNumber: "",
      reference: "",
      date: "",
      status: "all"
    })
  }

  const filteredPayments = payments.filter(payment => {
    const contractMatch = payment.contractNumber.toLowerCase().includes(searchParams.contractNumber.toLowerCase())
    const referenceMatch = payment.reference.toLowerCase().includes(searchParams.reference.toLowerCase())
    const dateMatch = searchParams.date 
      ? format(payment.paymentDate, 'yyyy-MM-dd') === searchParams.date
      : true
    const statusMatch = searchParams.status === "all"
      ? true
      : payment.status.toLowerCase() === searchParams.status.toLowerCase()

    return contractMatch && referenceMatch && dateMatch && statusMatch
  })

  const LoadingPaymentRow = () => (
    <TableRow>
      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
    </TableRow>
  )

  const LoadingSearchSection = () => (
    <div className="grid grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-10" />
      ))}
    </div>
  )

  const lookupContract = async () => {
    if (!formData.contractNumber.trim()) return

    setIsLookingUp(true)
    setError(null)
    try {
      // Query the contract
      const contractQuery = query(
        collection(db, 'Contracts'),
        where('contractNumber', '==', formData.contractNumber.trim().toUpperCase())
      )
      const contractSnapshot = await getDocs(contractQuery)

      if (contractSnapshot.empty) {
        setError('Contract not found')
        setContractDetails(null)
        return
      }

      const contractDoc = contractSnapshot.docs[0]
      const contractData = contractDoc.data()

      // Get policy details
      const policyRef = doc(db, 'Policies', contractData.policiesId)
      const policyDoc = await getDoc(policyRef)
      const policyAmount = policyDoc.exists() ? policyDoc.data().premium || 0 : 0

      // Get catering options tota
      let cateringTotal = 0
      if (contractData.cateringOptionIds && contractData.cateringOptionIds.length > 0) {
        for (const id of contractData.cateringOptionIds) {
          const cateringRef = doc(db, 'catering', id)
          const cateringDoc = await getDoc(cateringRef)
          if (cateringDoc.exists()) {
            cateringTotal += cateringDoc.data().price || 0
          }
        }
      }

      // Get main member details
      const memberQuery = query(
        collection(db, 'Members'),
        where('idNumber', '==', contractData.memberIdNumber)
      )
      const memberSnapshot = await getDocs(memberQuery)
      const memberName = memberSnapshot.empty ? 'Unknown' : 
        `${memberSnapshot.docs[0].data().firstName} ${memberSnapshot.docs[0].data().lastName}`

      const totalAmount = policyAmount + cateringTotal
      
      setContractDetails({
        policyAmount,
        cateringTotal,
        totalAmount,
        mainMemberName: memberName
      })

      // Update form data with the calculated amount
      setFormData(prev => ({
        ...prev,
        amount: totalAmount.toString()
      }))
    } catch (err) {
      console.error('Error looking up contract:', err)
      setError('Failed to lookup contract details')
      setContractDetails(null)
    } finally {
      setIsLookingUp(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Payment Management</CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                onClick={() => {
                  setEditingPayment(null)
                  setFormData({
                    contractNumber: "",
                    amount: "",
                    paymentMethod: "",
                    reference: "",
                    receiptUrl: ""
                  })
                }}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Payment
                  </>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingPayment ? 'Edit Payment' : 'Add New Payment'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Label htmlFor="contractNumber">Contract Number</Label>
                    <Input
                      id="contractNumber"
                      placeholder="Enter contract number"
                      value={formData.contractNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, contractNumber: e.target.value }))}
                    />
                  </div>
                  <Button
                    type="button"
                    className="mt-8"
                    onClick={lookupContract}
                    disabled={isLookingUp || !formData.contractNumber.trim()}
                  >
                    {isLookingUp ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      
                      </>
                    ) : (
                      <>
                        <Search className="mr-2 h-4 w-4" />
                        
                      </>
                    )}
                  </Button>
                </div>
                {contractDetails && (
                  <div className="space-y-4 p-4 bg-[#F8F9FC] rounded-lg border-2 border-[#E4E7EC]">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Policy Amount:</span>
                      <span className="text-base font-semibold">
                        R {contractDetails.policyAmount.toLocaleString()}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Catering Total:</span>
                      <span className="text-base font-semibold">
                        R {contractDetails.cateringTotal.toLocaleString()}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center pt-2 border-t border-[#E4E7EC]">
                      <span className="text-sm font-medium">Total Amount:</span>
                      <span className="text-lg font-bold">
                        R {contractDetails.totalAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
                <div hidden={true} className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="Enter amount"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentMethod">Payment Method</Label>
                  <Select
                    value={formData.paymentMethod}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, paymentMethod: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Credit Card">Credit Card</SelectItem>
                      <SelectItem value="Debit Card">Debit Card</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reference">Reference</Label>
                  <Input
                    id="reference"
                    placeholder="Auto-generated reference"
                    value={formData.reference}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    Receipt Image
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-sm text-muted-foreground">
                            (Required)
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Upload a picture of the receipt - this is required</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <div className="flex items-center gap-4">
                    <Input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      id="receipt-upload"
                      required
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          handleFileUpload(file)
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant={formData.receiptUrl ? "outline" : "secondary"}
                      onClick={() => document.getElementById('receipt-upload')?.click()}
                      className="flex items-center gap-2"
                      disabled={uploadingReceipt}
                    >
                      {uploadingReceipt ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          {formData.receiptUrl ? 'Change Receipt' : 'Upload Receipt *'}
                        </>
                      )}
                    </Button>
                    {formData.receiptUrl && (
                      <div className="flex items-center gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="p-0"
                                onClick={() => window.open(previewUrl || formData.receiptUrl, '_blank')}
                              >
                                <FileImage className="h-4 w-4 text-green-500" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Click to view receipt</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <span className="text-sm text-muted-foreground">Receipt uploaded</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, receiptUrl: "" }))
                            setPreviewUrl(null)
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {editingPayment ? 'Updating...' : 'Adding...'}
                      </>
                    ) : (
                      editingPayment ? 'Update Payment' : 'Add Payment'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isLoading ? (
              <LoadingSearchSection />
            ) : (
              <div className="grid grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by contract..."
                    value={searchParams.contractNumber}
                    onChange={(e) => handleSearchChange('contractNumber', e.target.value)}
                    className="pl-8"
                  />
                </div>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by reference..."
                    value={searchParams.reference}
                    onChange={(e) => handleSearchChange('reference', e.target.value)}
                    className="pl-8"
                  />
                </div>
                <div className="relative">
                  <Input
                    type="date"
                    value={searchParams.date}
                    onChange={(e) => handleSearchChange('date', e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Select
                  value={searchParams.status}
                  onValueChange={(value) => handleSearchChange('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {(searchParams.contractNumber || searchParams.reference || searchParams.date || searchParams.status !== "all") && !isLoading && (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSearch}
                  className="flex items-center gap-2"
                  disabled={isLoading}
                >
                  <X className="h-4 w-4" />
                  Clear Filters
                </Button>
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contract Number</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <LoadingPaymentRow key={index} />
                  ))
                ) : filteredPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <AlertCircle className="h-8 w-8" />
                        <p>No payments found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{payment.contractNumber}</TableCell>
                      <TableCell>R {payment.amount.toLocaleString()}</TableCell>
                      <TableCell>{payment.paymentMethod}</TableCell>
                      <TableCell>{payment.reference}</TableCell>
                      <TableCell>{format(payment.paymentDate, 'dd/MM/yyyy')}</TableCell>
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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