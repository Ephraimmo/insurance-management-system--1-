"use client"

import { Suspense } from 'react'
import dynamic from 'next/dynamic'

// Dynamically import the client content component with no SSR
const InsuranceManagementSystemClientContent = dynamic(
  () => import('@/app/components/InsuranceManagementSystemClientContent'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }
)

export default function InsuranceManagementSystem() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
    </div>
      }
    >
      <InsuranceManagementSystemClientContent />
    </Suspense>
  )
}

