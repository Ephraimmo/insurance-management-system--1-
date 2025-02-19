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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { loginWithEmail, loginWithUsername, logoutUser } from "@/src/authFunctions"

export default function InsuranceManagementSystem() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentPage, setCurrentPage] = useState("dashboard")
  const [isAdmin, setIsAdmin] = useState(false)
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [environment, setEnvironment] = useState('<User Default>')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [userRole, setUserRole] = useState('')

  // Add click handler for role alert
  const handleClick = (e: React.MouseEvent) => {
    if (isLoggedIn && userRole) {
      console.log(`Current User Role: ${userRole}`)
    }
  }

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    
    try {
      if (isAdmin) {
        // Admin login with email
        if (!email || !password) {
          setError('Please enter both email and password')
          return
        }
        
        if (!validateEmail(email)) {
          setError('Please enter a valid email address')
          return
        }

        const result = await loginWithEmail(email, password)
        
        if (result.success) {
          setIsLoggedIn(true)
          setUserRole(result.role)
          setCurrentPage('dashboard')
        } else {
          setError(result.error || 'Failed to login')
        }
      } else {
        // Regular user login with username
        if (!username || !password) {
          setError('Please enter both username and password')
          return
        }

        const result = await loginWithUsername(username, password)
        
        if (result.success) {
          setIsLoggedIn(true)
          setUserRole(result.role)
          setCurrentPage('dashboard')
        } else {
          setError(result.error || 'Failed to login')
        }
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err?.message || 'Failed to login. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

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
      case "cateringMaintenance":
        return <CateringMaintenance />
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

  if (!isLoggedIn) {
    return (
      <div className="h-screen flex overflow-hidden" onClick={handleClick}>
        {/* Left Panel - Login Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-slate-50">
          <div className="w-full max-w-md space-y-4">
            {/* Logo */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 mb-2">
                <Building2 className="w-6 h-6 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Sign in</h2>
              <p className="mt-1 text-sm text-slate-600">
                Enter your credentials to access your account
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div 
                id={error.replace(/\s+/g, '-').toLowerCase()}
                className="bg-red-50 border-l-4 border-red-500 p-3 flex items-center space-x-3"
              >
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <p id={`error-${error.replace(/\s+/g, '-').toLowerCase()}`} className="text-sm text-red-700">
                  {error}
                </p>
              </div>
            )}

            {/* Updated Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Dynamic Input Field */}
              <div>
                <Label htmlFor={isAdmin ? 'Email' : 'Username'} className="text-sm">
                  {isAdmin ? 'Email' : 'Username'}
                </Label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-slate-400" />
                  </div>
                  <Input
                    id={isAdmin ? 'Email' : 'Username'}
                    type={isAdmin ? 'email' : 'text'}
                    value={isAdmin ? email : username}
                    onChange={(e) => isAdmin ? setEmail(e.target.value) : setUsername(e.target.value)}
                    className="pl-9 h-9"
                    placeholder={isAdmin ? 'Enter your email' : 'Enter your username'}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <Label htmlFor="Password" className="text-sm">Password</Label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-400" />
                  </div>
                  <Input
                    id="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 h-9"
                    placeholder="Enter your password"
                  />
                </div>
              </div>

              {/* Environment Selector */}
              <div>
                <Label htmlFor="Environment" className="text-sm">Environment</Label>
                <Select value={environment} onValueChange={setEnvironment}>
                  <SelectTrigger id="Environment" className="h-9">
                    <SelectValue placeholder="Select environment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem id="User Default" data-value="<User Default>" value="<User Default>">&lt;User Default&gt;</SelectItem>
                    <SelectItem id="Production" data-value="Production" value="Production">Production</SelectItem>
                    <SelectItem id="Testing" data-value="Testing" value="Testing">Testing</SelectItem>
                    <SelectItem id="Development" data-value="Development" value="Development">Development</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Submit Button */}
              <Button
                id="Sign in"
                type="submit"
                disabled={isLoading}
                className="w-full h-9"
              >
                {isLoading ? 'Signing in...' : 'Sign in'}
              </Button>

              {/* Admin Checkbox */}
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="Login as Admin"
                  data-value="Login as Admin"
                  checked={isAdmin}
                  onCheckedChange={(checked) => setIsAdmin(checked as boolean)}
                />
                <Label htmlFor="Login as Admin" id="Login as Admin" className="text-sm">
                  Login as Admin
                </Label>
              </div>
            </form>
          </div>
        </div>

        {/* Right Panel - Image */}
        <div className="hidden lg:block lg:w-1/2 relative">
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: 'url("https://images.unsplash.com/photo-1497366216548-37526070297c?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80")',
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-l from-slate-900/90 to-slate-900/50" />
            <div className="absolute bottom-0 left-0 right-0 p-12 text-white">
              <h2 className="text-3xl font-bold mb-3">Welcome to Insurance Management</h2>
              <p className="text-base text-gray-200">
                Streamline your insurance claims and policy management with our intelligent solutions
              </p>
            </div>
          </div>
        </div>
      </div>
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

