import { collection, doc, setDoc, serverTimestamp, writeBatch, getDoc, getDocs, query, where, orderBy, limit, startAfter } from "firebase/firestore"
import { db } from "./FirebaseConfg"

type ClaimDocument = {
  type: string
  url: string
}

type BankDetails = {
  accountHolder: string
  bankName: string
  accountType: string
  accountNumber: string
  branchCode: string
}

type DeceasedInfo = {
  firstName: string
  lastName: string
  idNumber: string
  dateOfDeath: string
  causeOfDeath: string
  placeOfDeath: string
  relationship: string
}

type ClaimDetails = {
  claim: {
    claimNumber: string
    contractNumber: string
    claimantName: string
    relationship: string
    serviceDate: string
    serviceProvider: string
    location: string
    status: string
    createdAt: Date
    updatedAt: Date
  }
  policy: {
    policyNumber: string
    holderName: string
    coverageAmount: number
  }
  deceased?: {
    firstName: string
    lastName: string
    idNumber: string
    dateOfDeath: string
    causeOfDeath: string
    placeOfDeath: string
    relationship: string
  }
  bankDetails: {
    accountHolder: string
    bankName: string
    accountType: string
    accountNumber: string
    branchCode: string
  }
  documents: Array<{
    type: string
    url: string
  }>
}

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
  field: string
  direction: 'asc' | 'desc'
}

type ClaimListResponse = {
  claims: Array<{
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
  }>
  lastVisible: any
  hasMore: boolean
}

type FirestoreClaimData = {
  contractNumber: string
  claimantName: string
  serviceProvider: string
  status: string
  location: string
  relationship: string
  serviceDate: string
  createdAt: any
  updatedAt: any
}

type FirestorePolicyData = {
  policyNumber: string
  holderName: string
  coverageAmount: number
}

type FirestoreDeceasedData = {
  firstName: string
  lastName: string
  idNumber: string
  dateOfDeath: string
  causeOfDeath: string
  placeOfDeath: string
  relationship: string
}

type FirestoreBankData = {
  accountHolder: string
  bankName: string
  accountType: string
  accountNumber: string
  branchCode: string
}

type FirestoreDocumentsData = {
  documents: Array<{
    type: string
    url: string
  }>
}

export async function saveClaimData({
  claimNumber,
  contractNumber,
  policyDetails,
  deceasedInfo,
  bankDetails,
  documents,
  claimDetails
}: {
  claimNumber: string
  contractNumber: string
  policyDetails: {
    policyNumber: string
    holderName: string
    coverageAmount: number
  }
  deceasedInfo: DeceasedInfo
  bankDetails: BankDetails
  documents: ClaimDocument[]
  claimDetails: Omit<ClaimDetails["claim"], "claimNumber" | "contractNumber" | "createdAt" | "updatedAt">
}) {
  try {
    const batch = writeBatch(db)

    // 1. Save Policy Information
    const policyRef = doc(db, 'ClaimPolicies', claimNumber)
    batch.set(policyRef, {
      ...policyDetails,
      contractNumber,
      claimNumber,
      createdAt: serverTimestamp()
    })

    // 2. Save Deceased Information
    const deceasedRef = doc(db, 'ClaimDeceased', claimNumber)
    batch.set(deceasedRef, {
      ...deceasedInfo,
      contractNumber,
      claimNumber,
      createdAt: serverTimestamp()
    })

    // 3. Save Bank Details
    const bankRef = doc(db, 'ClaimBankDetails', claimNumber)
    batch.set(bankRef, {
      bankDetails,
      contractNumber,
      claimNumber,
      createdAt: serverTimestamp()
    })

    // 4. Save Documents
    const documentsRef = doc(db, 'ClaimDocuments', claimNumber)
    batch.set(documentsRef, {
      documents,
      contractNumber,
      claimNumber,
      createdAt: serverTimestamp()
    })

    // 5. Save Claim Details
    const claimRef = doc(db, 'Claims', claimNumber)
    batch.set(claimRef, {
      ...claimDetails,
      contractNumber,
      claimNumber,
      status: "FNOL",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })

    await batch.commit()

    return {
      success: true,
      claimNumber
    }
  } catch (error) {
    console.error('Error saving claim data:', error)
    throw error
  }
}

export async function generateClaimNumber(): Promise<string> {
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `CLM${timestamp}${random}`
}

export async function getClaimDetails(claimNumber: string): Promise<ClaimDetails | null> {
  try {
    // Get main claim data
    const claimRef = doc(db, 'Claims', claimNumber)
    const claimDoc = await getDoc(claimRef)
    if (!claimDoc.exists()) {
      return null
    }
    const claimData = claimDoc.data()

    // Get policy information
    const policyRef = doc(db, 'ClaimPolicies', claimNumber)
    const policyDoc = await getDoc(policyRef)
    const policyData = policyDoc.data()

    // Get deceased information if exists
    const deceasedRef = doc(db, 'ClaimDeceased', claimNumber)
    const deceasedDoc = await getDoc(deceasedRef)
    const deceasedData = deceasedDoc.exists() ? deceasedDoc.data() : undefined

    // Get bank details
    const bankRef = doc(db, 'ClaimBankDetails', claimNumber)
    const bankDoc = await getDoc(bankRef)
    const bankData = bankDoc.data()

    // Get documents
    const documentsRef = doc(db, 'ClaimDocuments', claimNumber)
    const documentsDoc = await getDoc(documentsRef)
    const documentsData = documentsDoc.data()

    return {
      claim: {
        claimNumber,
        contractNumber: claimData.contractNumber,
        claimantName: claimData.claimantName,
        relationship: claimData.relationship,
        serviceDate: claimData.serviceDate,
        serviceProvider: claimData.serviceProvider,
        location: claimData.location,
        status: claimData.status,
        createdAt: claimData.createdAt?.toDate(),
        updatedAt: claimData.updatedAt?.toDate()
      },
      policy: {
        policyNumber: policyData?.policyNumber,
        holderName: policyData?.holderName,
        coverageAmount: policyData?.coverageAmount
      },
      deceased: deceasedData ? {
        firstName: deceasedData.firstName,
        lastName: deceasedData.lastName,
        idNumber: deceasedData.idNumber,
        dateOfDeath: deceasedData.dateOfDeath,
        causeOfDeath: deceasedData.causeOfDeath,
        placeOfDeath: deceasedData.placeOfDeath,
        relationship: deceasedData.relationship
      } : undefined,
      bankDetails: {
        accountHolder: bankData?.accountHolder,
        bankName: bankData?.bankName,
        accountType: bankData?.accountType,
        accountNumber: bankData?.accountNumber,
        branchCode: bankData?.branchCode
      },
      documents: documentsData?.documents || []
    }
  } catch (error) {
    console.error('Error fetching claim details:', error)
    throw error
  }
}

export async function getAllClaimDetails(
  searchParams: SearchParams,
  sortConfig: SortConfig,
  lastVisible: any,
  pageSize: number
): Promise<ClaimListResponse> {
  try {
    // Build base query for claims
    let claimsQuery = collection(db, 'Claims')
    let constraints: any[] = []

    // Add search filters
    if (searchParams.contractNumber) {
      constraints.push(where('contractNumber', '==', searchParams.contractNumber))
    }
    if (searchParams.claimId) {
      constraints.push(where('claimNumber', '==', searchParams.claimId))
    }
    if (searchParams.status !== 'all') {
      constraints.push(where('status', '==', searchParams.status))
    }
    if (searchParams.dateFrom) {
      constraints.push(where('createdAt', '>=', new Date(searchParams.dateFrom)))
    }
    if (searchParams.dateTo) {
      constraints.push(where('createdAt', '<=', new Date(searchParams.dateTo)))
    }


    // Add pagination
    constraints.push(limit(pageSize))
    if (lastVisible) {
      constraints.push(startAfter(lastVisible))
    }

    const q = query(claimsQuery, ...constraints)
    const querySnapshot = await getDocs(q)

    // Fetch all related data in parallel for better performance
    const claimsList = await Promise.all(querySnapshot.docs.map(async claimDoc => {
      const claimData = claimDoc.data() as FirestoreClaimData
      const claimNumber = claimDoc.id

      // Fetch all related documents in parallel
      const [policyDoc, deceasedDoc, bankDoc, documentsDoc] = await Promise.all([
        getDoc(doc(db, 'ClaimPolicies', claimNumber)),
        getDoc(doc(db, 'ClaimDeceased', claimNumber)),
        getDoc(doc(db, 'ClaimBankDetails', claimNumber)),
        getDoc(doc(db, 'ClaimDocuments', claimNumber))
      ])

      const policyData = policyDoc.data() as FirestorePolicyData | undefined
      const deceasedData = deceasedDoc.exists() ? deceasedDoc.data() as FirestoreDeceasedData : null
      const bankData = bankDoc.data() as FirestoreBankData | undefined
      const documentsData = documentsDoc.data() as FirestoreDocumentsData | undefined

      // Filter by claimant name if specified
      if (searchParams.claimantName && 
          !claimData.claimantName?.toLowerCase().includes(searchParams.claimantName.toLowerCase())) {
        return null
      }

      // Filter by claim type if specified
      if (searchParams.claimType !== 'all' && 
          claimData.serviceProvider !== searchParams.claimType) {
        return null
      }

      return {
        id: claimNumber,
        contractNumber: claimData.contractNumber,
        claimantName: claimData.claimantName,
        claimType: claimData.serviceProvider,
        status: claimData.status,
        amount: policyData?.coverageAmount || 0,
        description: claimData.location,
        dateSubmitted: claimData.createdAt?.toDate(),
        lastUpdated: claimData.updatedAt?.toDate(),
        documents: documentsData?.documents?.map(doc => doc.url) || [],
        // Additional claim details
        relationship: claimData.relationship,
        serviceDate: claimData.serviceDate,
        serviceProvider: claimData.serviceProvider,
        location: claimData.location,
        policy: policyData ? {
          policyNumber: policyData.policyNumber,
          holderName: policyData.holderName,
          coverageAmount: policyData.coverageAmount
        } : null,
        deceased: deceasedData ? {
          firstName: deceasedData.firstName,
          lastName: deceasedData.lastName,
          idNumber: deceasedData.idNumber,
          dateOfDeath: deceasedData.dateOfDeath,
          causeOfDeath: deceasedData.causeOfDeath,
          placeOfDeath: deceasedData.placeOfDeath,
          relationship: deceasedData.relationship
        } : null,
        bankDetails: bankData ? {
          accountHolder: bankData.accountHolder,
          bankName: bankData.bankName,
          accountType: bankData.accountType,
          accountNumber: bankData.accountNumber,
          branchCode: bankData.branchCode
        } : null
      }
    }))

    // Filter out null values and handle the results
    const filteredClaims = claimsList.filter((claim): claim is NonNullable<typeof claim> => claim !== null)

    return {
      claims: filteredClaims,
      lastVisible: querySnapshot.docs[querySnapshot.docs.length - 1],
      hasMore: querySnapshot.docs.length === pageSize
    }
  } catch (error) {
    console.error('Error fetching claims:', error)
    throw error
  }
} 