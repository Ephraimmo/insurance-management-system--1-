"use client"

import { useState } from "react"
import { Layout } from "@/components/Layout"
import { Dashboard } from "@/components/Dashboard"
import { Policies } from "@/components/Policies"
import { Claims } from "@/components/Claims"
import { Customers } from "@/components/Customers"
import { Reports } from "@/components/Reports"
import { AddContract } from "@/components/AddContract"
import { SearchContract } from "@/components/SearchContract"
import { ClaimsProcessing } from "@/components/ClaimsProcessing"
import { CateringMaintenance } from "@/components/CateringMaintenance"
import { CategoryMaintenance } from "@/components/CategoryMaintenance"
import { FeatureMaintenance } from "@/components/FeatureMaintenance"
import { Payment } from "@/components/Payment"
import { UserManagement } from "@/components/UserManagement"
import { Building2, Lock, User, AlertCircle } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { loginWithEmail, loginWithUsername, logoutUser } from "@/src/authFunctions"

export default function InsuranceManagementSystemClientContent() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentPage, setCurrentPage] = useState("dashboard")
  const [isAdmin, setIsAdmin] = useState(false)
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [environment, setEnvironment] = useState('<User Default>')
  const [loginError, setLoginError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [userRole, setUserRole] = useState('')

  const handleLogout = async () => {
    try {
      await logoutUser()
      setIsLoggedIn(false)
      setUsername('')
      setEmail('')
      setPassword('')
      setEnvironment('<User Default>')
      setUserRole('')
      setIsAdmin(false)
    } catch (err) {
      console.error('Logout error:', err)
    }
  }

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <Dashboard />
      case "policies":
        return <Policies userRole={userRole} />
      case "claims":
        return <Claims userRole={userRole} />
      case "customers":
        return <Customers />
      case "reports":
        return <Reports />
      case "addContract":
        return <AddContract userRole={userRole} />
      case "searchContract":
        return <SearchContract userRole={userRole} />
      case "claimsProcessing":
        return <ClaimsProcessing userRole={userRole} />
      case "categoryMaintenance":
        return <CategoryMaintenance />
      case "featureMaintenance":
        return <FeatureMaintenance />
      case "payment":
        return <Payment />
      case "userManagement":
        return <UserManagement />
      default:
        return <Dashboard />
    }
  }

  return !isLoggedIn ? (
    <div className="h-screen flex overflow-hidden">
      {/* Login form JSX */}
    </div>
  ) : (
    <div>
      <Layout setCurrentPage={setCurrentPage} onLogout={handleLogout} userRole={userRole}>
        {renderPage()}
      </Layout>
    </div>
  )
} 