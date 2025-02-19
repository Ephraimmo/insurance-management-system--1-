"use client"

import dynamic from 'next/dynamic'

// Dynamically import the client content component with no SSR
const InsuranceManagementSystemClientContent = dynamic(
  () => import('@/app/components/InsuranceManagementSystemClientContent'),
  { ssr: false }
)

export default function InsuranceManagementSystem() {
  return <InsuranceManagementSystemClientContent />
}

