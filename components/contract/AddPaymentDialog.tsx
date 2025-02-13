import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Search } from "lucide-react"
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore"
import { db } from "@/src/FirebaseConfg"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface AddPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ContractDetails {
  policyAmount: number
  cateringTotal: number
  totalAmount: number
  mainMemberName: string
}

export function AddPaymentDialog({ open, onOpenChange }: AddPaymentDialogProps) {
  const [contractNumber, setContractNumber] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("")
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [isLookingUp, setIsLookingUp] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [contractDetails, setContractDetails] = useState<ContractDetails | null>(null)

  const lookupContract = async () => {
    if (!contractNumber.trim()) return

    setIsLookingUp(true)
    setError(null)
    try {
      // Query the contract
      const contractQuery = query(
        collection(db, 'Contracts'),
        where('contractNumber', '==', contractNumber.trim().toUpperCase())
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
      const policyAmount = policyDoc.exists() ? policyDoc.data().Price || 0 : 0

      // Get catering options total
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

      setContractDetails({
        policyAmount,
        cateringTotal,
        totalAmount: policyAmount + cateringTotal,
        mainMemberName: memberName
      })
    } catch (err) {
      console.error('Error looking up contract:', err)
      setError('Failed to lookup contract details')
      setContractDetails(null)
    } finally {
      setIsLookingUp(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Add New Payment</DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="contractNumber" className="text-base font-medium">
              Contract Number
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="contractNumber"
                  value={contractNumber}
                  onChange={(e) => setContractNumber(e.target.value)}
                  className="dialog-input"
                  placeholder="Enter contract number"
                />
              </div>
              <Button 
                onClick={lookupContract} 
                disabled={isLookingUp || !contractNumber.trim()}
                className="lookup-button"
              >
                {isLookingUp ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Search className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>

          {contractDetails && (
            <>
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

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="paymentMethod" className="text-right">
                  Payment Method
                </Label>
                <Select 
                  value={paymentMethod} 
                  onValueChange={setPaymentMethod}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="eft">EFT</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="receipt" className="text-right">
                  Receipt *
                </Label>
                <Input
                  id="receipt"
                  type="file"
                  accept="image/jpeg,image/png,image/jpg"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                  className="col-span-3"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={isSubmitting || !paymentMethod || !receiptFile}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Add Payment
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 