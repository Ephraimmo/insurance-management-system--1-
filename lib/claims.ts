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

export async function getClaimDetails(id: string): Promise<ClaimDetails> {
  try {
    // Add your actual API call here
    // For now, returning mock data
    return {
      id,
      contractNumber: "CNT-" + Math.random().toString(36).substr(2, 9),
      claimantName: "John Doe",
      claimType: "Property Damage",
      claimAmount: 5000,
      claimDate: new Date().toISOString(),
      status: "Pending",
      description: "Water damage to the kitchen",
      documents: ["claim-form.pdf", "damage-photos.zip"],
      assessorName: "Jane Smith",
      assessmentDate: new Date().toISOString(),
    }
  } catch (error) {
    console.error('Error in getClaimDetails:', error)
    throw new Error('Failed to fetch claim details')
  }
} 