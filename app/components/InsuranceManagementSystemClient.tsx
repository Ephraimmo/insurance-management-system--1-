"use client"

import dynamic from 'next/dynamic'

const InsuranceManagementSystemClientContent = dynamic(
  () => import('./InsuranceManagementSystemClientContent'),
  { ssr: false }
)

export default function InsuranceManagementSystemClient() {
  return <InsuranceManagementSystemClientContent />
} 