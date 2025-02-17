"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { collection, getDocs } from "firebase/firestore"
import { db } from "@/src/FirebaseConfg"
import { Loader2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { query, orderBy } from "firebase/firestore"

type Feature = {
  id: string
  name: string
  description?: string
}

type policies = {
  id: string
  name: string
  description: string
  premium: number
  coverAmount: number
  features: string[]
  maxDependents: number
}

type PoliciesSelectionProps = {
  selectedpolicies: {
    policiesId: string
    name: string
    coverAmount: string
    premium: number | null
  }
  onpolicieselect: (policies: { policiesId: string; name: string; coverAmount: string; premium: number | null }) => void
  selectedCateringOptions?: Array<{ id: string; name: string; price: number }>
}

export function PoliciesSelection({ 
  selectedpolicies, 
  onpolicieselect,
  selectedCateringOptions = [] 
}: PoliciesSelectionProps) {
  const [availablepolicies, setAvailablepolicies] = useState<policies[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadingpolicies, setLoadingpolicies] = useState<string | null>(null)
  const [availableFeatures, setAvailableFeatures] = useState<Feature[]>([])
  const [featureNames, setFeatureNames] = useState<Record<string, string>>({})

  useEffect(() => {
    const fetchpolicies = async () => {
      try {
        setLoading(true)
        setError(null)
        const policiesCollection = collection(db, 'Policies')
        const policiesSnapshot = await getDocs(policiesCollection)
        const policiesData = policiesSnapshot.docs.map(doc => {
          const data = doc.data()
          return {
            id: data.id,
            name: data.name || 'Unnamed policies',
            description: data.description || 'No description available',
            premium: data.premium || 0,
            coverAmount: data.coverAmount || 0,
            features: data.features || [],
            maxDependents: data.maxDependents || 0
          }
        }) as policies[]
        
        if (policiesData.length === 0) {
          setError('No policies available at the moment. Please try again later.')
        } else {
          setAvailablepolicies(policiesData)
        }
      } catch (err) {
        console.error('Error fetching policies:', err)
        setError('Failed to load policies. Please check your connection and try again.')
      } finally {
        setLoading(false)
      }
    }

    fetchpolicies()
  }, [])

  useEffect(() => {
    const fetchFeatures = async () => {
      try {
        const featuresQuery = query(
          collection(db, 'features'),
          orderBy('id', 'asc')
        )
        const querySnapshot = await getDocs(featuresQuery)
        const featuresData = querySnapshot.docs.map(doc => ({
          id: doc.data().id,
          ...doc.data()
        })) as Feature[]
        
        setAvailableFeatures(featuresData)
        
        const nameMapping = featuresData.reduce((acc, feature) => ({
          ...acc,
          [feature.id]: feature.name
        }), {})
        setFeatureNames(nameMapping)
      } catch (error) {
        console.error('Error fetching features:', error)
      }
    }

    fetchFeatures()
  }, [])

  const handlepolicieselect = async (policyName: string) => {
    try {
      setLoadingpolicies(policyName)
      const selected = availablepolicies.find((policy) => policy.name === policyName)
      if (selected) {
        onpolicieselect({
          policiesId: selected.id,
          name: selected.name,
          coverAmount: selected.coverAmount.toString(),
          premium: selected.premium
        })
      }
    } catch (err) {
      console.error('Error selecting policy:', err)
      setError('Failed to select policy. Please try again.')
    } finally {
      setLoadingpolicies(null)
    }
  }

  const calculateTotalPremium = () => {
    const policyPremium = selectedpolicies.premium || 0
    const cateringTotal = selectedCateringOptions.reduce((sum, option) => sum + option.price, 0)
    return policyPremium + cateringTotal
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="relative">
              <CardHeader>
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-24 mb-4" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertTitle>Error Loading policies</AlertTitle>
        <AlertDescription>
          {error}
          <button 
            onClick={() => window.location.reload()} 
            className="ml-2 underline hover:no-underline"
          >
            Refresh page
          </button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">Select a Policy</h2>
        <p className="text-muted-foreground">Choose the policy that best suits your needs and budget</p>
      </div>

      <RadioGroup
        value={selectedpolicies.name}
        onValueChange={handlepolicieselect}
      >
        <div className="grid gap-4 md:grid-cols-3">
          {availablepolicies.map((policies) => (
            <TooltipProvider key={policies.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className={`relative cursor-pointer transition-all duration-200 hover:shadow-md ${
                    selectedpolicies.name === policies.name 
                      ? 'border-primary ring-1 ring-primary ring-opacity-50 shadow-md transform scale-[1.01]' 
                      : 'hover:border-primary/50'
                  } ${loadingpolicies === policies.name ? 'opacity-70' : ''}`}>
                    <CardHeader className="space-y-3 p-4">
                      <div className="flex items-start space-x-3">
                        <RadioGroupItem 
                          value={policies.name}
                          id={policies.name}
                          data-value={policies.name}
                          disabled={loadingpolicies !== null}
                          className="h-4 w-4 mt-1" 
                        />
                        <div className="space-y-0.5">
                          <CardTitle>
                            <Label htmlFor={policies.name} className="cursor-pointer text-base font-semibold">
                              {policies.name}
                              {loadingpolicies === policies.name && (
                                <Loader2 className="w-3 h-3 ml-2 inline animate-spin" />
                              )}
                            </Label>
                          </CardTitle>
                          <CardDescription className="text-xs line-clamp-2">
                            {policies.description}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="pt-2 border-t">
                        <div className="flex justify-between items-baseline gap-3">
                          <div>
                            <div className="text-2xl font-bold text-primary">
                              R{policies.premium.toLocaleString()}
                            </div>
                            <div className="text-xs font-medium text-muted-foreground">
                              per month
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-gray-700">
                              R{policies.coverAmount.toLocaleString()}
                            </div>
                            <div className="text-xs font-medium text-muted-foreground">
                              cover amount
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="space-y-3">
                        <div className="text-xs font-medium text-muted-foreground">Policy Features:</div>
                        <ul className="space-y-2">
                          {policies.features.map((featureId) => (
                            <li key={featureId} className="flex items-center text-xs">
                              <span className="mr-2 flex-shrink-0 rounded-full bg-primary/10 p-0.5">
                                <svg className="h-2.5 w-2.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                </svg>
                              </span>
                              <span className="text-gray-600">{featureNames[featureId] || featureId}</span>
                            </li>
                          ))}
                          <li className="flex items-center text-xs mt-2 pt-2 border-t">
                            <span className="mr-2 flex-shrink-0">
                              <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" 
                                />
                              </svg>
                            </span>
                            <span className="font-medium text-blue-600">
                              Up to {policies.maxDependents} dependents included
                            </span>
                          </li>
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[250px]">
                  <div className="space-y-1.5">
                    <p className="font-medium text-sm">{policies.name}</p>
                    <p className="text-xs text-muted-foreground">{policies.description}</p>
                    <p className="text-xs">Includes coverage for up to {policies.maxDependents} dependents</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      </RadioGroup>

      {selectedpolicies.name && (
        <Alert className="mt-4 border-primary/20 bg-primary/5">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
            <AlertTitle className="text-primary font-semibold text-sm">Contract Overview</AlertTitle>
          </div>
          <AlertDescription className="mt-2 flex flex-col gap-1 text-sm">
            <div className="flex items-baseline gap-2">
              <span className="font-medium">Selected Policy:</span>
              <span className="font-semibold" id='Selected Policy'>{selectedpolicies.name}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-medium">Policy Premium:</span>
              <span className="font-semibold" id='Policy Premium'>R{selectedpolicies.premium?.toLocaleString()}</span>
            </div>
            {selectedCateringOptions.length > 0 && (
              <div className="flex items-baseline gap-2">
                <span className="font-medium">Catering Options Total:</span>
                <span className="font-semibold" id='Catering Options Total'>
                  R{selectedCateringOptions.reduce((sum, option) => sum + option.price, 0).toLocaleString()}
                </span>
              </div>
            )}
            <div className="flex items-baseline gap-2 pt-2 border-t mt-2">
              <span className="font-medium">Total Monthly Premium:</span>
              <span className="text-base font-bold text-primary" id='Total Monthly Premium'>
                R{calculateTotalPremium().toLocaleString()}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-medium">Cover Amount:</span>
              <span className="text-base font-bold" id='Cover Amount'>R{selectedpolicies.coverAmount}</span>
            </div>
            {availablepolicies.find(p => p.name === selectedpolicies.name)?.maxDependents && (
              <div className="text-xs text-muted-foreground mt-1">
                <span className="inline-flex items-center">
                  <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                    />
                  </svg>
                  Includes coverage for up to {availablepolicies.find(p => p.name === selectedpolicies.name)?.maxDependents} dependents
                </span>
              </div>
            )}
            {selectedCateringOptions.length > 0 && (
              <div className="mt-2 pt-2 border-t">
                <div className="text-xs font-medium text-muted-foreground mb-1">Selected Catering Options:</div>
                <ul className="space-y-1">
                  {selectedCateringOptions.map(option => (
                    <li key={option.id} className="text-xs flex justify-between">
                      <span>{option.name}</span>
                      <span className="font-medium">R{option.price.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

