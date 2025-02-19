import { ContractDetails } from "./ContractDetails"

// This is required for static site generation with `output: export`
export async function generateStaticParams() {
  // For static export, we need to provide at least one path
  // In a real app, you would fetch all possible contract IDs
  return [
    { id: "placeholder" }
  ]
}

export default function ContractPage({ params }: { params: { id: string } }) {
  return <ContractDetails id={params.id} />
}