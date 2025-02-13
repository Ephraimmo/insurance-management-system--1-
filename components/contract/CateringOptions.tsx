"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { collection, getDocs } from "firebase/firestore"
import { db } from "@/src/FirebaseConfg"
import { Loader2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type CateringOption = {
  id: string
  name: string
  description: string
  price: number
  available: boolean
  minimumOrder?: number
  maximumOrder?: number
}

type CateringOptionsProps = {
  selectedOptions: Array<{
    id: string
    name: string
    price: number
  }>
  onChange: (options: Array<{
    id: string
    name: string
    price: number
  }>) => void
}

export function CateringOptions({ selectedOptions, onChange }: CateringOptionsProps) {
  const [availableOptions, setAvailableOptions] = useState<CateringOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [togglingOption, setTogglingOption] = useState<string | null>(null)
  const [totalPrice, setTotalPrice] = useState(0)

  useEffect(() => {
    const fetchCateringOptions = async () => {
      try {
        setLoading(true)
        setError(null)
        const cateringCollection = collection(db, 'catering')
        const cateringSnapshot = await getDocs(cateringCollection)
        const cateringData = cateringSnapshot.docs.map(doc => {
          const data = doc.data()
          return {
            id: doc.id,
            name: data.name || 'Unnamed Option',
            description: data.description || 'No description available',
            price: data.price || 0,
            available: data.available !== false,
            minimumOrder: data.minimumOrder,
            maximumOrder: data.maximumOrder
          }
        }) as CateringOption[]
        
        if (cateringData.length === 0) {
          setError('No catering options available at the moment. Please try again later.')
        } else {
          setAvailableOptions(cateringData)
        }
      } catch (err) {
        console.error('Error fetching catering options:', err)
        setError('Failed to load catering options. Please check your connection and try again.')
      } finally {
        setLoading(false)
      }
    }

    fetchCateringOptions()
  }, [])

  useEffect(() => {
    // Calculate total price whenever selected options change
    const total = selectedOptions.reduce((sum, option) => sum + option.price, 0)
    setTotalPrice(total)
  }, [selectedOptions])

  const handleOptionToggle = async (optionId: string) => {
    try {
      setTogglingOption(optionId)
      const option = availableOptions.find(opt => opt.id === optionId)
      if (!option) return

      if (selectedOptions.some(opt => opt.id === optionId)) {
        onChange(selectedOptions.filter(opt => opt.id !== optionId))
      } else {
        onChange([...selectedOptions, {
          id: option.id,
          name: option.name,
          price: option.price
        }])
      }
    } catch (err) {
      console.error('Error toggling option:', err)
      setError('Failed to update selection. Please try again.')
    } finally {
      setTogglingOption(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-6 w-24" />
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
        <AlertTitle>Error Loading Catering Options</AlertTitle>
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
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Additional Services</h2>
        <p className="text-muted-foreground">Select additional services you would like to include</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {availableOptions.map((option) => (
          <TooltipProvider key={option.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Card 
                  className={`relative transition-all duration-200 ${
                    selectedOptions.some(opt => opt.id === option.id) 
                      ? 'border-primary ring-2 ring-primary ring-opacity-50' 
                      : ''
                  } ${!option.available ? 'opacity-50' : ''} ${
                    togglingOption === option.id ? 'opacity-70' : ''
                  }`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={option.id}
                        checked={selectedOptions.some(opt => opt.id === option.id)}
                        onCheckedChange={() => handleOptionToggle(option.id)}
                        disabled={!option.available || togglingOption !== null}
                        className="data-[state=checked]:bg-primary"
                      />
                      <CardTitle>
                        <Label 
                          htmlFor={option.id} 
                          className={`cursor-pointer ${!option.available ? 'text-gray-400' : ''}`}
                        >
                          {option.name}
                          {togglingOption === option.id && (
                            <Loader2 className="w-4 h-4 ml-2 inline animate-spin" />
                          )}
                          {!option.available && (
                            <span className="ml-2 text-sm text-red-500">(Unavailable)</span>
                          )}
                        </Label>
                      </CardTitle>
                    </div>
                    <CardDescription>{option.description}</CardDescription>
                    {(option.minimumOrder || option.maximumOrder) && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {option.minimumOrder && <span>Minimum: {option.minimumOrder} • </span>}
                        {option.maximumOrder && <span>Maximum: {option.maximumOrder}</span>}
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold">
                      R{option.price.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                {!option.available 
                  ? 'This option is currently unavailable'
                  : togglingOption === option.id
                  ? 'Processing your selection...'
                  : selectedOptions.some(opt => opt.id === option.id)
                  ? 'Click to remove this option'
                  : 'Click to add this option'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>

      {selectedOptions.length > 0 && (
        <Alert className="mt-4">
          <AlertTitle>Selected Options ({selectedOptions.length})</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1">
              {selectedOptions.map(option => (
                <li key={option.id} className="flex justify-between">
                  <span>{option.name}</span>
                  <span>R{option.price.toLocaleString()}</span>
                </li>
              ))}
              <li className="flex justify-between font-bold pt-2 border-t">
                <span>Total</span>
                <span>R{totalPrice.toLocaleString()}</span>
              </li>
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

