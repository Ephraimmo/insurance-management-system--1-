export interface ClaimDetails {
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
  bankDetails?: {
    accountHolder: string
    bankName: string
    accountType: string
    accountNumber: string
    branchCode: string
  }
}

export async function getClaimDetails(id: string): Promise<ClaimDetails> {
  try {
    // Add your actual API call here
    // For now, returning mock data that matches the Claim interface
    return {
      id,
      contractNumber: "CNT-" + Math.random().toString(36).substr(2, 9),
      claimantName: "John Doe",
      claimType: "Death Benefit",
      status: "Pending",
      amount: 50000,
      description: "Death benefit claim",
      dateSubmitted: new Date(),
      lastUpdated: new Date(),
      documents: ["claim-form.pdf", "death-certificate.pdf"],
      relationship: "Spouse",
      serviceDate: new Date().toISOString(),
      serviceProvider: "N/A",
      location: "Johannesburg",
      policy: {
        policyNumber: "POL-" + Math.random().toString(36).substr(2, 9),
        holderName: "Jane Doe",
        coverageAmount: 100000
      },
      deceased: {
        firstName: "Jane",
        lastName: "Doe",
        idNumber: "8001015009087",
        dateOfDeath: new Date().toISOString(),
        causeOfDeath: "Natural Causes",
        placeOfDeath: "Johannesburg General Hospital",
        relationship: "Spouse"
      },
      bankDetails: {
        accountHolder: "John Doe",
        bankName: "Standard Bank",
        accountType: "Savings",
        accountNumber: "1234567890",
        branchCode: "051001"
      }
    }
  } catch (error) {
    console.error('Error in getClaimDetails:', error)
    throw new Error('Failed to fetch claim details')
  }
} 