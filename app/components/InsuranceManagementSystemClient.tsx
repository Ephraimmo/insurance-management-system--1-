"use client"

import { useState } from "react"
import { Layout } from "../components/Layout"
import { Dashboard } from "../components/Dashboard"
import { Policies } from "../components/Policies"
import { Claims } from "../components/Claims"
import { Customers } from "../components/Customers"
import { Reports } from "../components/Reports"
import { AddContract } from "../components/AddContract"
import { SearchContract } from "../components/SearchContract"
import { ClaimsProcessing } from "../components/ClaimsProcessing"
import { CateringMaintenance } from "../components/CateringMaintenance"
import { CategoryMaintenance } from "../components/CategoryMaintenance"
import { FeatureMaintenance } from "../components/FeatureMaintenance"
import { Payment } from "../components/Payment"
import { UserManagement } from "../components/UserManagement"
import { Building2, Lock, User } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { loginWithEmail, loginWithUsername, logoutUser } from "@/src/authFunctions"

interface InsuranceManagementSystemClientProps {
  data?: any;
  error?: string;
}

export function InsuranceManagementSystemClient({ data, error }: InsuranceManagementSystemClientProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentPage, setCurrentPage] = useState("dashboard")
  const [isAdmin, setIsAdmin] = useState(false)
  // ... copy all other states and functions from your original page.tsx

  // Copy all your existing component logic here
  
  if (!isLoggedIn) {
    return (
      // Your existing login form JSX
    )
  }

  return (
    <div onClick={handleClick}>
      <Layout setCurrentPage={setCurrentPage} onLogout={handleLogout} userRole={userRole}>
        {renderPage()}
      </Layout>
    </div>
  )
} 