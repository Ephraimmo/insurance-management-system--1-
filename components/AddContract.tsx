"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { MainMemberDetails } from "./contract/MainMemberDetails"
import { BeneficiaryDetails } from "./contract/BeneficiaryDetails"
import { DependentDetails } from "./contract/DependentDetails"
import { ContractSummary } from "./contract/ContractSummary"
import { PoliciesSelection } from "./contract/PoliciesSelection"
import { CateringOptions } from "./contract/CateringOptions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, AlertCircle, CheckCircle2, ArrowLeft, ArrowRight } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { collection, addDoc, doc, setDoc, serverTimestamp, runTransaction, writeBatch, getDoc, updateDoc } from "firebase/firestore"
import { db } from "@/src/FirebaseConfg"
import { useRouter } from "next/navigation"

type TabName = "policies" | "catering" | "main-member" | "beneficiaries" | "dependents" | "summary"

type ContractData = {
  mainMember: {
    personalInfo: {
      title: string
      firstName: string
      lastName: string
      initials: string
      dateOfBirth: Date | null
      gender: string
      language: string
      maritalStatus: string
      nationality: string
      idType: "South African ID" | "Passport"
      idNumber: string
      idDocumentUrl: string | null
    }
    contactDetails: Array<{
      type: "Email" | "Phone Number"
      value: string
    }>
    addressDetails: {
      streetAddress: string
      city: string
      stateProvince: string
      postalCode: string
      country: string
    }
    contractNumber?: string
    contractId?: string
  }
  beneficiaries: Array<{
    personalInfo: {
      title: string
      firstName: string
      lastName: string
      initials: string
      dateOfBirth: Date | null
      gender: string
      relationshipToMainMember: string
      nationality: string
      idType: "South African ID" | "Passport"
      idNumber: string
      beneficiaryPercentage: number
      idDocumentUrl: string | null
    }
    contactDetails: Array<{
      type: "Email" | "Phone Number"
      value: string
    }>
    addressDetails: {
      streetAddress: string
      city: string
      stateProvince: string
      postalCode: string
      country: string
    }
  }>
  dependents: Array<{
    personalInfo: {
      firstName: string
      lastName: string
      initials: string
      dateOfBirth: Date | null
      gender: string
      relationshipToMainMember: string
      nationality: string
      idType: "South African ID" | "Passport"
      idNumber: string
      dependentStatus: "Active" | "Inactive"
      medicalAidNumber?: string
      employer?: string
      school?: string
      idDocumentUrl: string | null
    }
    contactDetails: Array<{
      type: "Email" | "Phone Number"
      value: string
    }>
    addressDetails: {
      streetAddress: string
      city: string
      stateProvince: string
      postalCode: string
      country: string
    }
  }>
  policiesDetails: {
    policiesId: string
    name: string
    coverAmount: string
    premium: number | null
  }
  cateringOptions: Array<{
    id: string
    name: string
    price: number
  }>
}

const emptyContractData: ContractData = {
  mainMember: {
    personalInfo: {
      title: "",
      firstName: "",
      lastName: "",
      initials: "",
      dateOfBirth: null,
      gender: "",
      language: "",
      maritalStatus: "",
      nationality: "",
      idType: "South African ID",
      idNumber: "",
      idDocumentUrl: null,
    },
    contactDetails: [],
    addressDetails: {
      streetAddress: "",
      city: "",
      stateProvince: "",
      postalCode: "",
      country: "",
    },
  },
  beneficiaries: [],
  dependents: [],
  policiesDetails: {
    policiesId: "",
    name: "",
    coverAmount: "",
    premium: null
  },
  cateringOptions: []
}

function ContractDisplay({ contractNumber, progress }: { contractNumber: string | undefined, progress: number }) {
  if (!contractNumber) return null;

  const getStatusColor = (progress: number) => {
    if (progress === 100) return "bg-green-50 border-green-200 text-green-700"
    if (progress > 50) return "bg-blue-50 border-blue-200 text-blue-700"
    return "bg-yellow-50 border-yellow-200 text-yellow-700"
  }

  const getStatusText = (progress: number) => {
    if (progress === 100) return "Ready for Submission"
    if (progress > 50) return "In Progress"
    return "Getting Started"
  }

  return (
    <div className="mb-6">
      <Card className={`p-4 border ${getStatusColor(progress)}`}>
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              {progress === 100 ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
              )}
              <h3 className="text-lg font-semibold">Contract Status</h3>
            </div>
            <p className="text-sm mt-1">
              Contract Number: <span className="font-medium">{contractNumber}</span>
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm">Current Status</div>
            <Badge variant="outline" className={getStatusColor(progress)}>
              {getStatusText(progress)}
            </Badge>
          </div>
        </div>
      </Card>
    </div>
  )
}

interface AddContractProps {
  userRole?: string
}

export function AddContract({ userRole }: AddContractProps) {
  const [currentTab, setCurrentTab] = useState<TabName>("policies")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [contractData, setContractData] = useState<ContractData>({
    mainMember: {
      personalInfo: {
        title: "",
        firstName: "",
        lastName: "",
        initials: "",
        dateOfBirth: null,
        gender: "",
        language: "",
        maritalStatus: "",
        nationality: "",
        idType: "South African ID",
        idNumber: "",
        idDocumentUrl: null,
      },
      contactDetails: [],
      addressDetails: {
        streetAddress: "",
        city: "",
        stateProvince: "",
        postalCode: "",
        country: "",
      }
    },
    beneficiaries: [],
    dependents: [],
    policiesDetails: {
      policiesId: "",
      name: "",
      coverAmount: "",
      premium: null
    },
    cateringOptions: []
  })
  const [isLoading, setIsLoading] = useState(false)
  const [tabChangeBlocked, setTabChangeBlocked] = useState(false)
  const router = useRouter()
  const [successDialogOpen, setSuccessDialogOpen] = useState(false)
  const [submittedContractNumber, setSubmittedContractNumber] = useState<string | null>(null)

  // Reset function to clear all data
  const resetContractData = () => {
    setCurrentTab("policies")
    setError(null)
    setIsSubmitDialogOpen(false)
    setContractData({
      mainMember: {
        personalInfo: {
          title: "",
          firstName: "",
          lastName: "",
          initials: "",
          dateOfBirth: null,
          gender: "",
          language: "",
          maritalStatus: "",
          nationality: "",
          idType: "South African ID",
          idNumber: "",
          idDocumentUrl: null,
        },
        contactDetails: [],
        addressDetails: {
          streetAddress: "",
          city: "",
          stateProvince: "",
          postalCode: "",
          country: "",
        }
      },
      beneficiaries: [],
      dependents: [],
      policiesDetails: {
        policiesId: "",
        name: "",
        coverAmount: "",
        premium: null
      },
      cateringOptions: []
    })
    // Clear session storage
    sessionStorage.removeItem('mainMember')
  }

  // Call reset function when component mounts
  useEffect(() => {
    resetContractData()
  }, [])

  const calculateProgress = () => {
    let progress = 0
    let total = 0

    // policies selection validation (required)
    total += 1
    if (contractData.policiesDetails.policiesId) progress++

    // Catering options validation (optional)
    if (contractData.cateringOptions.length > 0) {
      progress++
      total++
    }

    // Main member validation
    const mainMember = contractData.mainMember.personalInfo
    total += 5 // Required fields
    if (mainMember.firstName) progress++
    if (mainMember.lastName) progress++
    if (mainMember.idNumber) progress++
    if (mainMember.dateOfBirth) progress++
    if (mainMember.gender) progress++

    // Beneficiaries validation (at least one required)
    total += 1
    if (contractData.beneficiaries.length > 0) {
      const totalPercentage = contractData.beneficiaries.reduce(
        (sum, ben) => sum + ben.personalInfo.beneficiaryPercentage,
        0
      )
      if (totalPercentage === 100) progress++
    }

    return Math.round((progress / total) * 100)
  }

  const handleTabChange = (value: string) => {
    if (tabChangeBlocked) return
    
    setError(null)
    setIsLoading(true)
    
    // Validate current tab before allowing change
    const canProceed = validateCurrentTab(value as TabName)
    
    if (canProceed) {
    setCurrentTab(value as TabName)
    }
    
    setIsLoading(false)
  }

  const validateCurrentTab = (tab: TabName): boolean => {
    let isValid = true;
    
    try {
      console.log("Validating tab:", tab, "policiesDetails:", contractData.policiesDetails);
      
      // First check if policies is selected for all tabs except "policies"
      if (tab !== "policies" && (!contractData.policiesDetails?.policiesId || !contractData.policiesDetails?.name)) {
        console.log("Failed validation - policiesId:", contractData.policiesDetails?.policiesId, "name:", contractData.policiesDetails?.name);
        setError("Please select a policy before proceeding to other sections.")
        return false;
      }

      switch (tab) {
        case "policies":
          // No validation needed for policies tab
          break;

        case "catering":
          // Catering is optional, only validate policies selection
          if (!contractData.policiesDetails?.policiesId || !contractData.policiesDetails?.name) {
            setError("Please select a policy before proceeding to catering options.")
            isValid = false;
          }
          break;

        case "main-member":
          // Only validate policies selection, which is already done above
          break;

        case "dependents":
          // Only check if main member exists in the table
          if (!contractData.mainMember.personalInfo.firstName) {
            setError("Please add main member details before proceeding");
            return false;
          }
          break;

        case "beneficiaries":
        case "summary":
          // First validate main member details
          const { personalInfo: otherTabsMainMember } = contractData.mainMember;
          const otherTabsRequiredFields = [
            { key: 'firstName', label: 'First Name' },
            { key: 'lastName', label: 'Last Name' },
            { key: 'idNumber', label: 'ID Number' },
            { key: 'dateOfBirth', label: 'Date of Birth' },
            { key: 'gender', label: 'Gender' }
          ];

          const otherTabsMissingFields = otherTabsRequiredFields
            .filter(({ key }) => {
              const value = otherTabsMainMember[key as keyof typeof otherTabsMainMember];
              return key === 'dateOfBirth' ? !value : !String(value).trim();
            })
            .map(({ label }) => label);

          //if (otherTabsMissingFields.length > 0) {
          //  setError(`Please complete the following main member fields: ${otherTabsMissingFields.join(', ')}`);
          //  return false;
          //}

          //// Validate ID number format
          //if (otherTabsMainMember.idType === "South African ID" && !/^\d{13}$/.test(otherTabsMainMember.idNumber)) {
          //  setError("Main member ID number must be 13 digits");
          //  return false;
          //}

          //// Validate contact details
          //if (contractData.mainMember.contactDetails.length === 0) {
          //  setError("Please add at least one contact detail for the main member");
          //  return false;
          //}

          // Validate beneficiaries
          if (tab === "summary" && contractData.beneficiaries.length === 0) {
            setError("At least one beneficiary is required");
            return false;
          }
          break;
      }
    } catch (error) {
      console.error('Error in validateCurrentTab:', error)
      setError('An error occurred while validating the form')
      isValid = false
    }

    return isValid
  }

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true)
      setError(null)

      // Validate all required fields
      if (!validateCurrentTab("summary")) {
        setIsSubmitting(false)
        return
      }

      // Update contract status to "In-Force" in Firestore
      if (contractData.mainMember.contractId) {
        const contractRef = doc(db, 'Contracts', contractData.mainMember.contractId)
        await updateDoc(contractRef, {
          status: 'In-Force',
          updatedAt: new Date()
        })
      }

      // Show success message
      const contractNumber = contractData.mainMember.contractNumber
      setSubmittedContractNumber(contractNumber ? contractNumber : null)
      setIsSubmitDialogOpen(false)
      setSuccessDialogOpen(true)

      // Reset form after 2 seconds and return to main page
      setTimeout(() => {
        resetContractData()
        router.push('/')
      }, 2000)
    } catch (error) {
      console.error('Error submitting contract:', error)
      setError('Failed to submit contract. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const progress = calculateProgress()

  return (
    <div className="container mx-auto py-6 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">New Contract</h1>
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={currentTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="policies" disabled={isLoading || tabChangeBlocked}>
            policies
            {isLoading && currentTab === "policies" && (
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            )}
          </TabsTrigger>
          <TabsTrigger value="catering" disabled={isLoading || tabChangeBlocked}>
            Catering
            {isLoading && currentTab === "catering" && (
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            )}
          </TabsTrigger>
          <TabsTrigger value="main-member" disabled={isLoading || tabChangeBlocked}>
            Main Member
            {isLoading && currentTab === "main-member" && (
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            )}
          </TabsTrigger>
          <TabsTrigger value="dependents" disabled={isLoading || tabChangeBlocked}>
            Dependents
            {isLoading && currentTab === "dependents" && (
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            )}
          </TabsTrigger>
          <TabsTrigger value="beneficiaries" disabled={isLoading || tabChangeBlocked}>
            Beneficiaries
            {isLoading && currentTab === "beneficiaries" && (
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            )}
          </TabsTrigger>
          <TabsTrigger value="summary" disabled={isLoading || tabChangeBlocked}>
            Summary
            {isLoading && currentTab === "summary" && (
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="main-member">
          <Card className="p-6">
            <MainMemberDetails
              mainMember={contractData.mainMember}
              updateMainMember={(mainMember) => setContractData({ ...contractData, mainMember })}
              selectedPolicies={{
                ...contractData.policiesDetails,
                policiesId: contractData.policiesDetails.policiesId
              }}
              selectedCateringOptions={contractData.cateringOptions}
              userRole={userRole}
            />
          </Card>
        </TabsContent>

        <TabsContent value="beneficiaries">
          <Card className="p-6">
            <BeneficiaryDetails
              contractNumber={contractData.mainMember.contractNumber}
              mainMemberIdNumber={contractData.mainMember.personalInfo.idNumber}
              beneficiaries={contractData.beneficiaries}
              updateBeneficiaries={(beneficiaries) => setContractData({ ...contractData, beneficiaries })}
            />
          </Card>
        </TabsContent>

        <TabsContent value="dependents">
          <Card className="p-6">
            <DependentDetails
              dependents={contractData.dependents}
              updateDependents={(dependents) => setContractData({ ...contractData, dependents })}
              contractNumber={contractData.mainMember.contractNumber}
              mainMemberIdNumber={contractData.mainMember.personalInfo.idNumber}
            />
          </Card>
        </TabsContent>

        <TabsContent value="policies">
          <Card className="p-6">
            <PoliciesSelection
              selectedpolicies={contractData.policiesDetails}
              onpolicieselect={(policiesDetails: { policiesId: string; name: string; coverAmount: string; premium: number | null }) => 
                setContractData({ ...contractData, policiesDetails })}
            />
          </Card>
        </TabsContent>

        <TabsContent value="catering">
          <Card className="p-6">
            <CateringOptions
              selectedOptions={contractData.cateringOptions}
              onChange={(cateringOptions) => setContractData({ ...contractData, cateringOptions })}
            />
          </Card>
        </TabsContent>

        <TabsContent value="summary">
          <Card className="p-6">
            <ContractSummary
              data={contractData}
              onEdit={(tab) => handleTabChange(tab)}
            />
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-between space-x-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
        <Button 
          id="Previous"
          variant="outline" 
          onClick={() => handleTabChange(
                  currentTab === "policies" ? "policies" :
                  currentTab === "catering" ? "policies" :
                  currentTab === "main-member" ? "catering" :
                  currentTab === "dependents" ? "main-member" :
                  currentTab === "beneficiaries" ? "dependents" :
                  "beneficiaries"
                )}
                disabled={currentTab === "policies" || isLoading || tabChangeBlocked}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
          Previous
        </Button>
            </TooltipTrigger>
            <TooltipContent>
              Go back to previous section
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="space-x-4">
          <Button 
            id="Cancel"
            variant="outline" 
            onClick={() => {
              if (window.confirm("Are you sure you want to cancel? All progress will be lost.")) {
                setContractData(emptyContractData)
                setCurrentTab("policies")
                setError(null)
              }
            }}
            disabled={isLoading || tabChangeBlocked}
          >
            Cancel
          </Button>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  id={currentTab === "summary" ? "Submit" : "Next"}
                  onClick={() => {
                    if (currentTab === "summary") {
                      setIsSubmitDialogOpen(true)
                    } else {
                      handleTabChange(
                        currentTab === "policies" ? "catering" :
                        currentTab === "catering" ? "main-member" :
                        currentTab === "main-member" ? "dependents" :
                        currentTab === "dependents" ? "beneficiaries" :
                        "summary"
                      )
                    }
                  }}
                  disabled={isLoading || tabChangeBlocked}
                  className="gap-2"
                >
                  {currentTab === "summary" ? (
                    <>Submit</>
                  ) : (
                    <>
                      Next
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {currentTab === "summary" 
                  ? "Submit the contract for processing"
                  : "Proceed to next section"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <Dialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Contract</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {error ? (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : (
              <Alert className="mb-4">
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Ready to Submit</AlertTitle>
                <AlertDescription>
                  Please review all information before submitting. This action cannot be undone.
                </AlertDescription>
              </Alert>
            )}
            
            <div className="mt-4 space-y-4">
              <div className="flex justify-between text-sm">
                <span>Contract Number</span>
                <span className="font-medium">{contractData.mainMember.contractNumber}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Main Member</span>
                <span className="font-medium">
                  {contractData.mainMember.personalInfo.firstName} {contractData.mainMember.personalInfo.lastName}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Selected policies</span>
                <span className="font-medium">{contractData.policiesDetails.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Monthly Premium</span>
                <span className="font-medium">
                  R{((contractData.policiesDetails.premium || 0) + 
                    contractData.cateringOptions.reduce((sum, opt) => sum + opt.price, 0)).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              id="Cancel"
              variant="outline"
              onClick={() => setIsSubmitDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              id="Confirm Submission"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Confirm Submission
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              Contract Submitted Successfully
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="flex flex-col items-center space-y-4">
              <div className="rounded-full bg-green-50 p-3">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold">Contract #{submittedContractNumber}</p>
                <p className="text-sm text-gray-500 mt-1">
                  Your contract has been submitted successfully.
                </p>
              </div>
              <div className="text-sm text-gray-500">
                Redirecting to contract details...
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

