export type Claim = {
  id: string
  claimNumber?: string
  contractNumber: string
  claimantName: string
  claimType: string
  status: string
  amount: number
  description: string
  dateSubmitted: Date
  lastUpdated: Date
  documents?: Array<{
    type: string
    url: string
  }>
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
  }
  bankDetails?: {
    accountHolder: string
    bankName: string
    accountType: string
    accountNumber: string
    branchCode: string
  }
} 