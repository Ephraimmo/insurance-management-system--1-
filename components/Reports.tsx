import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
import { Download, FileSpreadsheet, FileText, FileType2, Loader2, Search } from "lucide-react"
import { DateRange } from "react-day-picker"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { format } from "date-fns"
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import { Parser } from 'json2csv'
import { Progress } from "@/components/ui/progress"
import { db } from "@/lib/FirebaseConfig"
import { collection, query, where, getDocs } from "firebase/firestore"
import { Dialog, DialogContent } from "@/components/ui/dialog"

// Update type declaration
interface AutoTable {
  autoTable: (options: any) => jsPDF;
}
declare module 'jspdf' {
  interface jsPDF extends AutoTable {}
}

// Add these interfaces at the top
interface ClaimData {
  claimNumber: string
  contractNumber: string
  status: string
  type: string
  date: Date
  amount: number
}

interface ContractData {
  contractNumber: string
  status: string
  policyType: string
  cateringType: string
  startDate: Date
  memberName: string
}

interface PaymentData {
  contractNumber: string
  paymentMethod: string
  status: string
  amount: number
  date: Date
  reference: string
}

// Add this interface at the top with other interfaces
interface FirestoreClaim {
  id: string;
  claimNumber: string;
  contractNumber: string;
  status: string;
  type: string;
  date: { toDate: () => Date };
  lastUpdated: { toDate: () => Date };
  amount: number;
}

interface FirestoreContract {
  id: string;
  contractNumber: string;
  memberIdNumber: string;
  status: string;
  policyType: string;
  cateringOptionIds: string[];
  createdAt: { toDate: () => Date };
  policiesId: { toDate: () => Date };
}

interface FirestorePayment {
  id: string;
  contractNumber: string;
  reference: string;
  paymentMethod: string;
  status: string;
  amount: number;
  paymentDate: { toDate: () => Date };
  receiptUrl: string;
}

export function Reports() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [reportType, setReportType] = useState("Claims")
  const [reportData, setReportData] = useState<any[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [filteredData, setFilteredData] = useState<any[]>([])
  
  // Add demo data
  const demoClaimsData: ClaimData[] = [
    {
      claimNumber: "CLM001",
      contractNumber: "CNT001",
      status: "approved",
      type: "death",
      date: new Date("2024-01-15"),
      amount: 15000
    },
    {
      claimNumber: "CLM002",
      contractNumber: "CNT002",
      status: "pending",
      type: "funeral",
      date: new Date("2024-02-20"),
      amount: 25000
    },
    // Add more demo claims...
  ]

  const demoContractsData: ContractData[] = [
    {
      contractNumber: "CNT001",
      status: "active",
      policyType: "silver",
      cateringType: "option1",
      startDate: new Date("2023-12-01"),
      memberName: "John Doe"
    },
    {
      contractNumber: "CNT002",
      status: "active",
      policyType: "gold",
      cateringType: "option2",
      startDate: new Date("2024-01-10"),
      memberName: "Jane Smith"
    },
    // Add more demo contracts...
  ]

  const demoPaymentsData: PaymentData[] = [
    {
      contractNumber: "CNT001",
      paymentMethod: "cash",
      status: "completed",
      amount: 1200,
      date: new Date("2024-02-01"),
      reference: "PAY001"
    },
    {
      contractNumber: "CNT002",
      paymentMethod: "eft",
      status: "completed",
      amount: 2500,
      date: new Date("2024-02-15"),
      reference: "PAY002"
    },
    // Add more demo payments...
  ]

  // Add these state variables at the top of the Reports function
  const [claimFilters, setClaimFilters] = useState({
    claimNumber: '',
    contractNumber: '',
    status: '',
    type: ''
  })

  const [contractFilters, setContractFilters] = useState({
    status: '',
    policyType: '',
    cateringType: ''
  })

  const [paymentFilters, setPaymentFilters] = useState({
    contractNumber: '',
    paymentMethod: '',
    status: ''
  })

  // Load initial data
  useEffect(() => {
    handleSearch()
  }, [reportType])

  // Add these filter functions
  const filterClaims = () => {
    return demoClaimsData.filter(claim => {
      const matchClaimNumber = claimFilters.claimNumber ? 
        claim.claimNumber.toLowerCase().includes(claimFilters.claimNumber.toLowerCase()) : true
      const matchContractNumber = claimFilters.contractNumber ? 
        claim.contractNumber.toLowerCase().includes(claimFilters.contractNumber.toLowerCase()) : true
      const matchStatus = claimFilters.status ? 
        claim.status === claimFilters.status : true
      const matchType = claimFilters.type ? 
        claim.type === claimFilters.type : true
      const matchDate = dateRange?.from && dateRange?.to ? 
        claim.date >= dateRange.from && claim.date <= dateRange.to : true

      return matchClaimNumber && matchContractNumber && matchStatus && matchType && matchDate
    })
  }

  const filterContracts = () => {
    return demoContractsData.filter(contract => {
      const matchStatus = contractFilters.status ? 
        contract.status === contractFilters.status : true
      const matchPolicyType = contractFilters.policyType ? 
        contract.policyType === contractFilters.policyType : true
      const matchCateringType = contractFilters.cateringType ? 
        contract.cateringType === contractFilters.cateringType : true
      const matchDate = dateRange?.from && dateRange?.to ? 
        contract.startDate >= dateRange.from && contract.startDate <= dateRange.to : true

      return matchStatus && matchPolicyType && matchCateringType && matchDate
    })
  }

  const filterPayments = () => {
    return demoPaymentsData.filter(payment => {
      const matchContractNumber = paymentFilters.contractNumber ? 
        payment.contractNumber.toLowerCase().includes(paymentFilters.contractNumber.toLowerCase()) : true
      const matchPaymentMethod = paymentFilters.paymentMethod ? 
        payment.paymentMethod === paymentFilters.paymentMethod : true
      const matchStatus = paymentFilters.status ? 
        payment.status === paymentFilters.status : true
      const matchDate = dateRange?.from && dateRange?.to ? 
        payment.date >= dateRange.from && payment.date <= dateRange.to : true

      return matchContractNumber && matchPaymentMethod && matchStatus && matchDate
    })
  }

  // Replace generateReport with handleSearch
  const handleSearch = () => {
    setSearchLoading(true)
    let data: any[] = []
    
    switch(reportType) {
      case "Claims":
        data = filterClaims()
        break
      case "contracts":
        data = filterContracts()
        break
      case "payments":
        data = filterPayments()
        break
    }
    
    setFilteredData(data)
    setSearchLoading(false)
  }

  const renderReportTable = (data: any[]) => {
    return (
      <div className="mt-6">
        <Table>
          <TableHeader>
            {/* ... existing TableHeader code ... */}
          </TableHeader>
          <TableBody>
            {/* ... existing TableBody code ... */}
          </TableBody>
        </Table>
      </div>
    )
  }

  const exportToExcel = async () => {
    if (reportType === "Claims") {
      setSearchLoading(true)
      try {
        // Create base query
        let claimsQuery = query(collection(db, "Claims"))
        
        // Create an array to store all the query constraints
        const queryConstraints = []
        
        // Only add filters if they have values
        if (claimFilters.claimNumber.trim()) {
          const searchTerm = claimFilters.claimNumber.trim()
          queryConstraints.push(
            where("claimNumber", ">=", searchTerm),
            where("claimNumber", "<=", searchTerm + '\uf8ff')
          )
        }
        
        if (claimFilters.contractNumber.trim()) {
          queryConstraints.push(
            where("contractNumber", "==", claimFilters.contractNumber.trim())
          )
        }
        
        if (claimFilters.status && claimFilters.status !== "all") {
          queryConstraints.push(
            where("status", "==", claimFilters.status)
          )
        }
        
        if (claimFilters.type && claimFilters.type !== "all") {
          queryConstraints.push(
            where("type", "==", claimFilters.type)
          )
        }
        
        // Apply all query constraints if any exist
        if (queryConstraints.length > 0) {
          claimsQuery = query(collection(db, "Claims"), ...queryConstraints)
        }
        
        const querySnapshot = await getDocs(claimsQuery)
         
        if (querySnapshot.empty) {
          alert("No data found matching your criteria")
          return
        }
        
        // Convert to array and filter by date if needed
        let claims = querySnapshot.docs.map(doc => ({
          id: doc.id,
          claimNumber: doc.data().claimNumber,
          contractNumber: doc.data().contractNumber,
          status: doc.data().status,
          type: doc.data().type,
          date: doc.data().createdAt,
          lastUpdated: doc.data().lastUpdated,
          amount: doc.data().amount
        } as FirestoreClaim))

        try {
        // Filter by date range if selected
        if (dateRange?.from && dateRange?.to) {
          claims = claims.filter(claim => {
            const claimDate = claim.date.toDate()
              return claimDate >= dateRange!.from! && claimDate <= dateRange!.to!
            })
          }   
          
        } catch (dateError) {
          alert("Error processing dates. Please check your date range selection.")
          return
        }
        
        if (claims.length === 0) {
          alert("No claims found for the selected criteria")
          return
        }

        // Prepare data for Excel
        const excelData = claims.map(claim => ({
          'Claim Number': claim.claimNumber || 'N/A',
          'Contract Number': claim.contractNumber || 'N/A',
          'Status': claim.status || 'N/A',
          'Type': claim.type || 'N/A',
          'Created Date': format(claim.date.toDate(), 'dd/MM/yyyy') || 'N/A',
          'lastUpdated': format(claim.lastUpdated.toDate(), 'dd/MM/yyyy') || 'N/A',
          //'Amount': `R ${claim.amount.toLocaleString()}` || 0
        }))
        
        // Create and save Excel file
        const ws = XLSX.utils.json_to_sheet(excelData)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Claims Report')
        XLSX.writeFile(wb, `Claims_Report_${format(new Date(), 'dd-MM-yyyy')}.xlsx`)
        
      } catch (error) {
        console.error("Error fetching claims:", error)
        alert("An error occurred while generating the report. Please try again.")
      } finally {
        setSearchLoading(false)
      }
    }
   
    if (reportType === "contracts") {
      setSearchLoading(true)
      try {
        let contractsQuery = query(collection(db, "Contracts"))
        const queryConstraints = []
        
        if (contractFilters.status && contractFilters.status !== "all") {
          queryConstraints.push(where("status", "==", contractFilters.status))
        }
        
        if (contractFilters.policyType && contractFilters.policyType !== "all") {
          queryConstraints.push(where("policyType", "==", contractFilters.policyType))
        }
        
        if (contractFilters.cateringType && contractFilters.cateringType !== "all") {
          queryConstraints.push(where("cateringType", "==", contractFilters.cateringType))
        }
        
        if (queryConstraints.length > 0) {
          contractsQuery = query(collection(db, "Contracts"), ...queryConstraints)
        }

        const querySnapshot = await getDocs(contractsQuery)
        
        if (querySnapshot.empty) {
          alert("No data found matching your criteria")
          return
        }

        let contracts = querySnapshot.docs.map(doc => ({
          id: doc.id,
          contractNumber: doc.data().contractNumber,
          memberIdNumber: doc.data().memberIdNumber,
          status: doc.data().status,
          policyType: doc.data().policyType,
          cateringOptionIds: doc.data().cateringOptionIds,
          createdAt: doc.data().createdAt,
          policiesId: doc.data().policiesId
        } as FirestoreContract))

        if (dateRange?.from && dateRange?.to) {
          contracts = contracts.filter(contract => {
            const contractDate = contract.createdAt.toDate()
            return contractDate >= dateRange!.from! && contractDate <= dateRange!.to!
          })
        }

        if (contracts.length === 0) {
          alert("No contracts found for the selected criteria")
          return
        }

        const excelData = contracts.map(contract => ({
          'Contract Number': contract.contractNumber || 'N/A',
          'Member ID Number': contract.memberIdNumber || 'N/A',
          'Status': contract.status || 'N/A',
          'Policy Type': contract.policyType || 'N/A',
          'Catering Options': contract.cateringOptionIds || 'N/A',
          'Created Date': format(contract.createdAt.toDate(), 'dd/MM/yyyy') || 'N/A',
          'Policies ID': contract.policiesId || 'N/A'
        }))

      const ws = XLSX.utils.json_to_sheet(excelData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Contracts Report')
      XLSX.writeFile(wb, `Contracts_Report_${format(new Date(), 'dd-MM-yyyy')}.xlsx`)

      } catch (error) {
        console.error("Error fetching contracts:", error)
        alert("An error occurred while generating the report. Please try again.")
      } finally {
        setSearchLoading(false)
      }
    }
    if (reportType === "payments") {
      setSearchLoading(true)
      try {
        let paymentsQuery = query(collection(db, "Payments"))
        const queryConstraints = []
        
        if (paymentFilters.contractNumber.trim()) {
          queryConstraints.push(
            where("contractNumber", "==", paymentFilters.contractNumber.trim())
          )
        }
        
        if (paymentFilters.paymentMethod && paymentFilters.paymentMethod !== "all") {
          queryConstraints.push(where("paymentMethod", "==", paymentFilters.paymentMethod))
        }
        
        if (paymentFilters.status && paymentFilters.status !== "all") {
          queryConstraints.push(where("status", "==", paymentFilters.status))
        }
        
        if (queryConstraints.length > 0) {
          paymentsQuery = query(collection(db, "Payments"), ...queryConstraints)
        }

        const querySnapshot = await getDocs(paymentsQuery)
        
        if (querySnapshot.empty) {
          alert("No data found matching your criteria")
          return
        }

        let payments = querySnapshot.docs.map(doc => ({
          id: doc.id,
          contractNumber: doc.data().contractNumber,
          reference: doc.data().reference,
          paymentMethod: doc.data().paymentMethod,
          status: doc.data().status,
          amount: doc.data().amount,
          paymentDate: doc.data().paymentDate,
          receiptUrl: doc.data().receiptUrl
        } as FirestorePayment))

        if (dateRange?.from && dateRange?.to) {
          payments = payments.filter(payment => {
            const paymentDate = payment.paymentDate.toDate()
            return paymentDate >= dateRange!.from! && paymentDate <= dateRange!.to!
          })
        }

        if (payments.length === 0) {
          alert("No payments found for the selected criteria")
          return
        }

        const excelData = payments.map(payment => ({
          'Contract Number': payment.contractNumber || 'N/A',
          'Reference': payment.reference || 'N/A',
          'Payment Method': payment.paymentMethod || 'N/A',
          'Status': payment.status || 'N/A',
          'Amount': payment.amount ? `R ${payment.amount.toLocaleString()}` : 'N/A',
          'Created Date': format(payment.paymentDate.toDate(), 'dd/MM/yyyy') || 'N/A',
          'receiptUrl': payment.receiptUrl || 'N/A'
        }))

      const ws = XLSX.utils.json_to_sheet(excelData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Payments Report')
      XLSX.writeFile(wb, `Payments_Report_${format(new Date(), 'dd-MM-yyyy')}.xlsx`)

      } catch (error) {
        console.error("Error fetching payments:", error)
        alert("An error occurred while generating the report. Please try again.")
      } finally {
        setSearchLoading(false)
      }
    }
  }

  const exportToCSV = () => {
    if (reportType === "Claims") {
      setSearchLoading(true)
      try {
        // Create base query
        let claimsQuery = query(collection(db, "Claims"))
        const queryConstraints = []
        
        if (claimFilters.claimNumber.trim()) {
          const searchTerm = claimFilters.claimNumber.trim()
          queryConstraints.push(
            where("claimNumber", ">=", searchTerm),
            where("claimNumber", "<=", searchTerm + '\uf8ff')
          )
        }
        
        if (claimFilters.contractNumber.trim()) {
          queryConstraints.push(
            where("contractNumber", "==", claimFilters.contractNumber.trim())
          )
        }
        
        if (claimFilters.status && claimFilters.status !== "all") {
          queryConstraints.push(where("status", "==", claimFilters.status))
        }
        
        if (claimFilters.type && claimFilters.type !== "all") {
          queryConstraints.push(where("type", "==", claimFilters.type))
        }
        
        if (queryConstraints.length > 0) {
          claimsQuery = query(collection(db, "Claims"), ...queryConstraints)
        }

        getDocs(claimsQuery).then(querySnapshot => {
          if (querySnapshot.empty) {
            alert("No data found matching your criteria")
            return
          }

          let claims = querySnapshot.docs.map(doc => ({
            id: doc.id,
            claimNumber: doc.data().claimNumber,
            contractNumber: doc.data().contractNumber,
            status: doc.data().status,
            type: doc.data().type,
            date: doc.data().createdAt,
            lastUpdated: doc.data().lastUpdated,
            amount: doc.data().amount
          } as FirestoreClaim))

          if (dateRange?.from && dateRange?.to) {
            claims = claims.filter(claim => {
              const claimDate = claim.date.toDate()
              return claimDate >= dateRange!.from! && claimDate <= dateRange!.to!
            })
          }

          if (claims.length === 0) {
            alert("No claims found for the selected criteria")
            return
          }

          const fields = ['Claim Number', 'Contract Number', 'Status', 'Type', 'Created Date', 'Last Updated']
          const data = claims.map(claim => ({
            'Claim Number': claim.claimNumber || 'N/A',
            'Contract Number': claim.contractNumber || 'N/A',
            'Status': claim.status || 'N/A',
            'Type': claim.type || 'N/A',
            'Created Date': format(claim.date.toDate(), 'dd/MM/yyyy') || 'N/A',
            'Last Updated': format(claim.lastUpdated.toDate(), 'dd/MM/yyyy') || 'N/A'
      }))

      const json2csvParser = new Parser({ fields })
      const csv = json2csvParser.parse(data)
      
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `Claims_Report_${format(new Date(), 'dd-MM-yyyy')}.csv`
      link.click()
        }).catch(error => {
          console.error("Error fetching claims:", error)
          alert("An error occurred while generating the CSV. Please try again.")
        }).finally(() => {
          setSearchLoading(false)
        })
      } catch (error) {
        console.error("Error:", error)
        alert("An error occurred. Please try again.")
        setSearchLoading(false)
      }
    }
    if (reportType === "contracts") {
      setSearchLoading(true)
      try {
        let contractsQuery = query(collection(db, "Contracts"))
        const queryConstraints = []
        
        if (contractFilters.status && contractFilters.status !== "all") {
          queryConstraints.push(where("status", "==", contractFilters.status))
        }
        
        if (contractFilters.policyType && contractFilters.policyType !== "all") {
          queryConstraints.push(where("policyType", "==", contractFilters.policyType))
        }
        
        if (queryConstraints.length > 0) {
          contractsQuery = query(collection(db, "Contracts"), ...queryConstraints)
        }

        getDocs(contractsQuery).then(querySnapshot => {
          if (querySnapshot.empty) {
            alert("No data found matching your criteria")
            return
          }

          let contracts = querySnapshot.docs.map(doc => ({
            id: doc.id,
            contractNumber: doc.data().contractNumber,
            memberIdNumber: doc.data().memberIdNumber,
            status: doc.data().status,
            policyType: doc.data().policyType,
            cateringOptionIds: doc.data().cateringOptionIds,
            createdAt: doc.data().createdAt,
            policiesId: doc.data().policiesId
          } as FirestoreContract))

          if (dateRange?.from && dateRange?.to) {
            contracts = contracts.filter(contract => {
              const contractDate = contract.createdAt.toDate()
              return contractDate >= dateRange!.from! && contractDate <= dateRange!.to!
            })
          }

          if (contracts.length === 0) {
            alert("No contracts found for the selected criteria")
            return
          }

          const fields = ['Contract Number', 'Member ID Number', 'Status', 'Policy Type', 'Catering Options', 'Created Date', 'Policies ID']
          const data = contracts.map(contract => ({
            'Contract Number': contract.contractNumber || 'N/A',
            'Member ID Number': contract.memberIdNumber || 'N/A',
            'Status': contract.status || 'N/A',
            'Policy Type': contract.policyType || 'N/A',
            'Catering Options': contract.cateringOptionIds || 'N/A',
            'Created Date': format(contract.createdAt.toDate(), 'dd/MM/yyyy') || 'N/A',
            'Policies ID': contract.policiesId || 'N/A'
      }))

      const json2csvParser = new Parser({ fields })
      const csv = json2csvParser.parse(data)
      
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `Contracts_Report_${format(new Date(), 'dd-MM-yyyy')}.csv`
      link.click()
        }).catch(error => {
          console.error("Error fetching contracts:", error)
          alert("An error occurred while generating the CSV. Please try again.")
        }).finally(() => {
          setSearchLoading(false)
        })
      } catch (error) {
        console.error("Error:", error)
        alert("An error occurred. Please try again.")
        setSearchLoading(false)
      }
    }
    if (reportType === "payments") {
      setSearchLoading(true)
      try {
        let paymentsQuery = query(collection(db, "Payments"))
        const queryConstraints = []
        
        if (paymentFilters.contractNumber.trim()) {
          queryConstraints.push(
            where("contractNumber", "==", paymentFilters.contractNumber.trim())
          )
        }
        
        if (paymentFilters.paymentMethod && paymentFilters.paymentMethod !== "all") {
          queryConstraints.push(where("paymentMethod", "==", paymentFilters.paymentMethod))
        }
        
        if (paymentFilters.status && paymentFilters.status !== "all") {
          queryConstraints.push(where("status", "==", paymentFilters.status))
        }
        
        if (queryConstraints.length > 0) {
          paymentsQuery = query(collection(db, "Payments"), ...queryConstraints)
        }

        getDocs(paymentsQuery).then(querySnapshot => {
          if (querySnapshot.empty) {
            alert("No data found matching your criteria")
            return
          }

          let payments = querySnapshot.docs.map(doc => ({
            id: doc.id,
            contractNumber: doc.data().contractNumber,
            reference: doc.data().reference,
            paymentMethod: doc.data().paymentMethod,
            status: doc.data().status,
            amount: doc.data().amount,
            paymentDate: doc.data().paymentDate,
            receiptUrl: doc.data().receiptUrl
          } as FirestorePayment))

          if (dateRange?.from && dateRange?.to) {
            payments = payments.filter(payment => {
              const paymentDate = payment.paymentDate.toDate()
              return paymentDate >= dateRange!.from! && paymentDate <= dateRange!.to!
            })
          }

          if (payments.length === 0) {
            alert("No payments found for the selected criteria")
            return
          }

          const fields = ['Contract Number', 'Reference', 'Payment Method', 'Status', 'Amount', 'Created Date', 'Last Updated']
          const data = payments.map(payment => ({
            'Contract Number': payment.contractNumber || 'N/A',
            'Reference': payment.reference || 'N/A',
            'Payment Method': payment.paymentMethod || 'N/A',
            'Status': payment.status || 'N/A',
            'Amount': payment.amount ? `R ${payment.amount.toLocaleString()}` : 'N/A',
            'Created Date': format(payment.paymentDate.toDate(), 'dd/MM/yyyy') || 'N/A',
            'receiptUrl': payment.receiptUrl || 'N/A'
      }))

      const json2csvParser = new Parser({ fields })
      const csv = json2csvParser.parse(data)
      
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `Payments_Report_${format(new Date(), 'dd-MM-yyyy')}.csv`
      link.click()
        }).catch(error => {
          console.error("Error fetching payments:", error)
          alert("An error occurred while generating the CSV. Please try again.")
        }).finally(() => {
          setSearchLoading(false)
        })
      } catch (error) {
        console.error("Error:", error)
        alert("An error occurred. Please try again.")
        setSearchLoading(false)
      }
    }
  }

  const exportToPDF = () => {
    if (reportType === "Claims") {
      setSearchLoading(true)
      try {
        let claimsQuery = query(collection(db, "Claims"))
        const queryConstraints = []
        
        if (claimFilters.claimNumber.trim()) {
          const searchTerm = claimFilters.claimNumber.trim()
          queryConstraints.push(
            where("claimNumber", ">=", searchTerm),
            where("claimNumber", "<=", searchTerm + '\uf8ff')
          )
        }
        
        if (claimFilters.contractNumber.trim()) {
          queryConstraints.push(
            where("contractNumber", "==", claimFilters.contractNumber.trim())
          )
        }
        
        if (claimFilters.status && claimFilters.status !== "all") {
          queryConstraints.push(where("status", "==", claimFilters.status))
        }
        
        if (claimFilters.type && claimFilters.type !== "all") {
          queryConstraints.push(where("type", "==", claimFilters.type))
        }
        
        if (queryConstraints.length > 0) {
          claimsQuery = query(collection(db, "Claims"), ...queryConstraints)
        }

        getDocs(claimsQuery).then(querySnapshot => {
          if (querySnapshot.empty) {
            alert("No data found matching your criteria")
            return
          }

          let claims = querySnapshot.docs.map(doc => ({
            id: doc.id,
            claimNumber: doc.data().claimNumber,
            contractNumber: doc.data().contractNumber,
            status: doc.data().status,
            type: doc.data().type,
            date: doc.data().createdAt,
            lastUpdated: doc.data().lastUpdated,
            amount: doc.data().amount
          } as FirestoreClaim))

          if (dateRange?.from && dateRange?.to) {
            claims = claims.filter(claim => {
              const claimDate = claim.date.toDate()
              return claimDate >= dateRange!.from! && claimDate <= dateRange!.to!
            })
          }

          if (claims.length === 0) {
            alert("No claims found for the selected criteria")
            return
          }

      const doc = new jsPDF()
      
          const tableColumn = ["Claim Number", "Contract Number", "Status", "Type", "Created Date", "Last Updated"]
          const tableRows = claims.map(claim => [
            claim.claimNumber || 'N/A',
            claim.contractNumber || 'N/A',
            claim.status || 'N/A',
            claim.type || 'N/A',
            format(claim.date.toDate(), 'dd/MM/yyyy') || 'N/A',
            format(claim.lastUpdated.toDate(), 'dd/MM/yyyy') || 'N/A'
      ])

      doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 20,
        headStyles: { fillColor: [41, 128, 185] },
      })

      doc.save(`Claims_Report_${format(new Date(), 'dd-MM-yyyy')}.pdf`)
        }).catch(error => {
          console.error("Error fetching claims:", error)
          alert("An error occurred while generating the PDF. Please try again.")
        }).finally(() => {
          setSearchLoading(false)
        })
      } catch (error) {
        console.error("Error:", error)
        alert("An error occurred. Please try again.")
        setSearchLoading(false)
      }
    }
    if (reportType === "contracts") {
      setSearchLoading(true)
      try {
        let contractsQuery = query(collection(db, "Contracts"))
        const queryConstraints = []
        
        if (contractFilters.status && contractFilters.status !== "all") {
          queryConstraints.push(where("status", "==", contractFilters.status))
        }
        
        if (contractFilters.policyType && contractFilters.policyType !== "all") {
          queryConstraints.push(where("policyType", "==", contractFilters.policyType))
        }
        
        if (queryConstraints.length > 0) {
          contractsQuery = query(collection(db, "Contracts"), ...queryConstraints)
        }

        getDocs(contractsQuery).then(querySnapshot => {
          if (querySnapshot.empty) {
            alert("No data found matching your criteria")
            return
          }

          let contracts = querySnapshot.docs.map(doc => ({
            id: doc.id,
            contractNumber: doc.data().contractNumber,
            memberIdNumber: doc.data().memberIdNumber,
            status: doc.data().status,
            policyType: doc.data().policyType,
            cateringOptionIds: doc.data().cateringOptionIds,
            createdAt: doc.data().createdAt,
            policiesId: doc.data().policiesId
          } as FirestoreContract))

          if (dateRange?.from && dateRange?.to) {
            contracts = contracts.filter(contract => {
              const contractDate = contract.createdAt.toDate()
              return contractDate >= dateRange!.from! && contractDate <= dateRange!.to!
            })
          }

          if (contracts.length === 0) {
            alert("No contracts found for the selected criteria")
            return
          }

      const doc = new jsPDF()
      
          const tableColumn = ["Contract Number", "Member ID Number", "Status", "Policy Type", "Catering Options", "Created Date", "Policies ID"]
          const tableRows = contracts.map(contract => [
            contract.contractNumber || 'N/A',
            contract.memberIdNumber || 'N/A',
            contract.status || 'N/A',
            contract.policyType || 'N/A',
            contract.cateringOptionIds || 'N/A',
            format(contract.createdAt.toDate(), 'dd/MM/yyyy') || 'N/A',
            contract.policiesId || 'N/A'
      ])

      doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 20,
        headStyles: { fillColor: [41, 128, 185] },
      })

      doc.save(`Contracts_Report_${format(new Date(), 'dd-MM-yyyy')}.pdf`)
        }).catch(error => {
          console.error("Error fetching contracts:", error)
          alert("An error occurred while generating the PDF. Please try again.")
        }).finally(() => {
          setSearchLoading(false)
        })
      } catch (error) {
        console.error("Error:", error)
        alert("An error occurred. Please try again.")
        setSearchLoading(false)
      }
    }
    if (reportType === "payments") {
      const doc = new jsPDF()
      
      const tableColumn = ["Contract Number", "Reference", "Payment Method", "Status", "Amount", "Date"]
      const tableRows = reportData.map(payment => [
        payment.contractNumber,
        payment.reference,
        payment.paymentMethod,
        payment.status,
        `R ${payment.amount.toLocaleString()}`,
        format(payment.date, 'dd/MM/yyyy')
      ])

      doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 20,
        headStyles: { fillColor: [41, 128, 185] },
      })

      doc.save(`Payments_Report_${format(new Date(), 'dd-MM-yyyy')}.pdf`)
    }
  }

  const LoadingDialog = () => {
    return (
      <Dialog open={searchLoading}>
        <DialogContent className="flex flex-col items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p>Generating report, please wait...</p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <div className="space-y-6">
      <LoadingDialog />
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Reports and Analytics</h2>
      </div>

      <Tabs value={reportType} onValueChange={setReportType}>
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger value="Claims">Claims Report</TabsTrigger>
          <TabsTrigger value="contracts">Contract Report</TabsTrigger>
          <TabsTrigger value="payments">Payment Report</TabsTrigger>
        </TabsList>

        <TabsContent value="Claims">
          <Card>
            <CardHeader>
              <CardTitle>Claims Report</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Claim Number</Label>
                    <Input 
                      placeholder="Enter claim number"
                      className="w-full"
                      value={claimFilters.claimNumber}
                      onChange={(e) => setClaimFilters({...claimFilters, claimNumber: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label>Contract Number</Label>
                    <Input 
                      placeholder="Enter contract number"
                      className="w-full"
                      value={claimFilters.contractNumber}
                      onChange={(e) => setClaimFilters({...claimFilters, contractNumber: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Status</Label>
                    <Select value={claimFilters.status} onValueChange={(value) => setClaimFilters({...claimFilters, status: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Claim Type</Label>
                    <Select value={claimFilters.type} onValueChange={(value) => setClaimFilters({...claimFilters, type: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="death">Death</SelectItem>
                        <SelectItem value="funeral">Funeral</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Date Range</Label>
                  <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contracts">
          <Card>
            <CardHeader>
              <CardTitle>Contract Report</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Status</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Policy Type</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select policy" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Policies</SelectItem>
                        <SelectItem value="silver">Silver</SelectItem>
                        <SelectItem value="gold">Gold</SelectItem>
                        <SelectItem value="platinum">Platinum</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Catering Type</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select catering" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="option1">Option 1</SelectItem>
                        <SelectItem value="option2">Option 2</SelectItem>
                        <SelectItem value="option3">Option 3</SelectItem>
                        <SelectItem value="option4">Option 4</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Date Range</Label>
                  <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>Payment Report</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Contract Number</Label>
                    <Input 
                      placeholder="Enter contract number"
                      className="w-full"
                    />
                  </div>
                  <div>
                    <Label>Payment Method</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Methods</SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="eft">EFT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Status</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Date Range</Label>
                  <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />
                </div>
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        {/* Export Buttons */}
        <div className="flex justify-end gap-4 mt-6">
          <Button 
            variant="outline" 
            className="flex items-center gap-2"
            onClick={exportToExcel}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export Excel
          </Button>
          <Button 
            variant="outline" 
            className="flex items-center gap-2"
            onClick={exportToCSV}
          >
            <FileText className="h-4 w-4" />
            Export CSV
          </Button>
          <Button 
            variant="outline" 
            className="flex items-center gap-2"
            onClick={exportToPDF}
          >
            <FileType2 className="h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </Tabs>

      {renderReportTable(filteredData)}
    </div>
  )
}

