import { ClaimDetails } from "./ClaimDetails"
import { getClaimDetails } from "@/lib/claims"

// This is required for static site generation with `output: export`
export async function generateStaticParams() {
  // For static export, we need to provide at least one path
  // In a real app, you would fetch all possible claim IDs
  return [
    { id: "placeholder" }
  ]
}

export default function ClaimPage({ params }: { params: { id: string } }) {
  return <ClaimDetails id={params.id} />
} 