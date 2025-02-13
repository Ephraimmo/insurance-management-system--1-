"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, Loader2, Plus, Pencil, Trash2, ArrowUpDown } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { collection, getDocs, query, orderBy, doc, getDoc, setDoc, addDoc, serverTimestamp, deleteDoc, where } from "firebase/firestore"
import { db } from "@/src/FirebaseConfg"
import { toast } from "@/components/ui/use-toast"

// Demo data
const demoPolicies = [
  {
    id: "POL001",
    name: "Basic Funeral Cover",
    description: "Essential funeral coverage for individuals and families",
    premium: 150,
    coverAmount: 25000,
    status: "active",
    maxDependents: 4,
    features: [
      "FEX001",
      "FEX002",
      "FEX003",
      "FEX004"
    ]
  },
]

type Policy = {
  id: string
  name: string
  description: string
  premium: number
  coverAmount: number
  status: string
  maxDependents: number
  features: string[]
  categoryId: string
}

type PolicyFormData = Policy & {
  category: string
}

type Feature = {
  id: string
  name: string
  description?: string
}

type Category = {
  id: string
  name: string
}

interface PoliciesProps {
  userRole?: string
}

export function Policies({ userRole }: PoliciesProps) {
  const canEdit = userRole && !['View Only', 'New Claim'].includes(userRole)

  const [policies, setPolicies] = useState<Policy[]>([])
  const [searchResults, setSearchResults] = useState<Policy[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useState({
    name: "",
    status: "all",
    category: "all",
    priceRange: "",
    coverAmountMin: "",
    coverAmountMax: "",
    dependentsMin: "",
    dependentsMax: "",
    sortBy: "name",
    sortOrder: "asc"
  })
  const [isSearching, setIsSearching] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState<PolicyFormData | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [formData, setFormData] = useState<PolicyFormData>({
    id: "",
    name: "",
    description: "",
    premium: 0,
    coverAmount: 0,
    status: "active",
    maxDependents: 0,
    features: [],
    categoryId: "",
    category: ""
  })
  const [newFeature, setNewFeature] = useState("")
  const [isAddingFeature, setIsAddingFeature] = useState(false)
  const [availableFeatures, setAvailableFeatures] = useState<Feature[]>([])
  const [featureNames, setFeatureNames] = useState<{ [key: string]: string }>({})
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingPolicy, setDeletingPolicy] = useState<Policy | null>(null)
  const [linkedPolicies, setLinkedPolicies] = useState<Set<string>>(new Set())
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Fetch policies from Firebase
  useEffect(() => {
    const fetchPolicies = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        // Create a query to get all policies ordered by name
        const policiesQuery = query(
          collection(db, 'Policies'),
          orderBy('name', 'asc')
        )
        
        // Get the documents
        const querySnapshot = await getDocs(policiesQuery)
        
        // Map the documents to our Policy type
        const policiesData = querySnapshot.docs.map(doc => {
          const data = doc.data()
          return {
            id: doc.id,
            name: data.name || '',
            description: data.description || '',
            premium: data.premium || 0,
            coverAmount: data.coverAmount || 0,
            status: data.status || 'inactive',
            maxDependents: data.maxDependents || 0,
            features: data.features || [],
            categoryId: data.categoryId || ''
          }
        })

        // Update both policies and searchResults state
        setPolicies(policiesData)
        setSearchResults(policiesData)
      } catch (error) {
        console.error('Error fetching policies:', error)
        setError('Failed to load policies. Please try again.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchPolicies()
  }, [])

  // Fetch features from Firebase
  useEffect(() => {
    const fetchFeatures = async () => {
      try {
        const featuresQuery = query(
          collection(db, 'features'),
          orderBy('id', 'asc')
        )
        const querySnapshot = await getDocs(featuresQuery)
        const featuresData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Feature[]
        
        setAvailableFeatures(featuresData)
        
        // Create a mapping of feature IDs to names
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

  useEffect(() => {
    const checkLinkedPolicies = async () => {
      try {
        const contractsRef = collection(db, 'Contracts')
        const querySnapshot = await getDocs(contractsRef)
        
        const linkedPolicyIds = new Set<string>()
        querySnapshot.forEach(doc => {
          const data = doc.data()
          if (data.policiesId) {
            linkedPolicyIds.add(data.policiesId)
          }
        })
        
        setLinkedPolicies(linkedPolicyIds)
      } catch (error) {
        console.error('Error checking linked policies:', error)
      }
    }

    checkLinkedPolicies()
  }, [])

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setIsLoadingCategories(true)
        const categoryQuery = query(
          collection(db, 'Category'),
          orderBy('id', 'asc')
        )
        const querySnapshot = await getDocs(categoryQuery)
        const categoryData = querySnapshot.docs.map(doc => ({
          id: doc.data().id,
          name: doc.data().name
        }))
        setCategories(categoryData)
      } catch (error) {
        console.error('Error fetching categories:', error)
      } finally {
        setIsLoadingCategories(false)
      }
    }

    fetchCategories()
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setSearchParams(prev => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (value: string, field: string) => {
    setSearchParams(prev => ({ ...prev, [field]: value }))
  }

  const handleSort = (field: string) => {
    setSearchParams(prev => ({
      ...prev,
      sortBy: field,
      sortOrder: prev.sortBy === field && prev.sortOrder === 'asc' ? 'desc' : 'asc'
    }))

    const sortedResults = [...searchResults].sort((a, b) => {
      const aValue = a[field as keyof typeof a]
      const bValue = b[field as keyof typeof b]
      const modifier = searchParams.sortOrder === 'asc' ? 1 : -1

      if (typeof aValue === 'string') {
        return aValue.localeCompare(String(bValue)) * modifier
      }
      return ((aValue as number) - (bValue as number)) * modifier
    })

    setSearchResults(sortedResults)
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSearching(true)

    try {
      const filtered = policies.filter(policy => {
        const nameMatch = policy.name.toLowerCase().includes(searchParams.name.toLowerCase())
        const statusMatch = searchParams.status === "all" || policy.status === searchParams.status
        const categoryMatch = searchParams.category === "all" || policy.categoryId === searchParams.category
        
        const priceRange = parseFloat(searchParams.priceRange)
        const priceMatch = !searchParams.priceRange || isNaN(priceRange) || 
          policy.premium <= priceRange
        
        const coverMin = parseFloat(searchParams.coverAmountMin)
        const coverMax = parseFloat(searchParams.coverAmountMax)
        const coverAmountMatch = 
          (!searchParams.coverAmountMin || isNaN(coverMin) || policy.coverAmount >= coverMin) &&
          (!searchParams.coverAmountMax || isNaN(coverMax) || policy.coverAmount <= coverMax)
        
        const depMin = parseFloat(searchParams.dependentsMin)
        const depMax = parseFloat(searchParams.dependentsMax)
        const dependentsMatch = 
          (!searchParams.dependentsMin || isNaN(depMin) || policy.maxDependents >= depMin) &&
          (!searchParams.dependentsMax || isNaN(depMax) || policy.maxDependents <= depMax)

        return nameMatch && statusMatch && categoryMatch && priceMatch && coverAmountMatch && dependentsMatch
      })

      // Sort the filtered results
      const sortedResults = [...filtered].sort((a, b) => {
        const aValue = a[searchParams.sortBy as keyof Policy]
        const bValue = b[searchParams.sortBy as keyof Policy]
        const modifier = searchParams.sortOrder === 'asc' ? 1 : -1

        if (typeof aValue === 'string') {
          return aValue.localeCompare(String(bValue)) * modifier
        }
        return ((aValue as number) - (bValue as number)) * modifier
      })

      setSearchResults(sortedResults)
    } catch (error) {
      console.error('Error searching policies:', error)
      setError('Failed to search policies. Please try again.')
    } finally {
      setIsSearching(false)
    }
  }

  // Reset search parameters and trigger search
  const handleResetSearch = () => {
    const defaultSearchParams = {
      name: "",
      status: "all",
      category: "all",
      priceRange: "",
      coverAmountMin: "",
      coverAmountMax: "",
      dependentsMin: "",
      dependentsMax: "",
      sortBy: "name",
      sortOrder: "asc"
    }
    
    setSearchParams(defaultSearchParams)
    
    // Create a synthetic event for the form submission
    const syntheticEvent = {
      preventDefault: () => {},
    } as React.FormEvent
    
    handleSearch(syntheticEvent)
  }

  const handleEdit = async (policy: Policy) => {
    try {
      setIsLoading(true)
      
      // Fetch feature details for the policy
      const featurePromises = policy.features.map(async (featureId) => {
        const featureRef = doc(db, 'features', featureId)
        const featureDoc = await getDoc(featureRef)
        return {
          id: featureDoc.id,
          ...featureDoc.data()
        } as Feature
      })
      
      const features = await Promise.all(featurePromises)
      const featureMapping = features.reduce((acc, feature) => ({
        ...acc,
        [feature.id]: feature.name
      }), {})

      categories.forEach(cat => {
        alert(cat.name)
      })
      
      // Get category name from categories state
      const categoryName = categories.find(cat => cat.id === policy.categoryId)?.name || ""
      alert(categoryName)
      setFeatureNames(prev => ({ ...prev, ...featureMapping }))
      setEditingPolicy({ ...policy, category: categoryName } as PolicyFormData)
      setFormData({
        ...policy,
        category: categoryName
      })
      setIsDialogOpen(true)
    } catch (error) {
      console.error('Error fetching policy details:', error)
      setError('Failed to load policy details. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddNew = () => {
    setEditingPolicy(null)
    setFormData({
      id: `POL${String(demoPolicies.length + 1).padStart(3, '0')}`,
      name: "",
      description: "",
      premium: 0,
      coverAmount: 0,
      status: "active",
      maxDependents: 0,
      features: [],
      categoryId: "",
      category: ""
    })
    setIsDialogOpen(true)
  }

  const handleFormInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'name' || name === 'description' ? value : Number(value)
    }))
  }

  const handleFormStatusChange = (value: string) => {
    setFormData(prev => ({ ...prev, status: value }))
  }

  const handleAddFeature = async () => {
    if (!newFeature.trim()) return

    try {
      setIsAddingFeature(true)
      
      // Find the feature in availableFeatures by name
      const selectedFeature = availableFeatures.find(
        f => f.name === newFeature
      )

      if (!selectedFeature) {
        setFormError("Please select a valid feature from the list")
        return
      }

      // Check for duplicates using the feature ID
      if (formData.features.includes(selectedFeature.id)) {
        setFormError("This feature is already added to the policy")
        return
      }
      
      // Add the feature ID
      setFormData(prev => ({
        ...prev,
        features: [...prev.features, selectedFeature.id]
      }))
      setNewFeature("")
      setFormError(null)
    } catch (error) {
      setFormError("Failed to add feature. Please try again.")
    } finally {
      setIsAddingFeature(false)
    }
  }

  const handleFeatureKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      await handleAddFeature()
    }
  }

  const handleRemoveFeature = (index: number) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index)
    }))
  }

  // Add this function before handleSubmit
  const generatePolicyId = async () => {
    try {
      const policiesRef = collection(db, 'Policies')
      const querySnapshot = await getDocs(policiesRef)
      
      // Get all existing IDs
      const existingIds = querySnapshot.docs
        .map(doc => doc.data().id || '')
        .filter(id => id.startsWith('POL'))
        .map(id => parseInt(id.substring(3)))
        .filter(num => !isNaN(num))

      // Find the highest number
      const highestNumber = existingIds.length > 0 ? Math.max(...existingIds) : 0
      
      // Generate next ID
      const nextNumber = highestNumber + 1
      const nextId = `POL${String(nextNumber).padStart(3, '0')}`
      
      return nextId
    } catch (error) {
      console.error('Error generating ID:', error)
      throw new Error('Failed to generate policy ID')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!formData.name || formData.premium <= 0 || formData.coverAmount <= 0 || formData.maxDependents <= 0 || !formData.category) {
      setFormError("Please fill in all required fields with valid values")
      return
    }

    try {
      setIsSaving(true)
      // Find the category ID from the selected category name
      const selectedCategory = categories.find(cat => cat.name === formData.category)
      if (!selectedCategory) {
        setFormError("Selected category not found")
        return
      }

      const policiesRef = collection(db, 'Policies')
      const policyData = {
        ...formData,
        categoryId: selectedCategory.id
      }

      if (editingPolicy) {
        // Update existing policy
        const policyRef = doc(db, 'Policies', editingPolicy.id)
        await setDoc(policyRef, {
          ...policyData,
          updatedAt: serverTimestamp()
        }, { merge: true })

        toast({
          title: "Success",
          description: "Policy updated successfully"
        })
      } else {
        // Create new policy
        const newPolicyId = await generatePolicyId()
        await setDoc(doc(policiesRef, newPolicyId), {
          ...policyData,
          id: newPolicyId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })

        toast({
          title: "Success",
          description: "Policy created successfully"
        })
      }

      // Reset form and close dialog
      setIsDialogOpen(false)
      setFormData({
        id: "",
        name: "",
        description: "",
        premium: 0,
        coverAmount: 0,
        status: "active",
        maxDependents: 0,
        features: [],
        categoryId: "",
        category: ""
      })
      setEditingPolicy(null)

      // Refresh policies list
      const updatedPoliciesQuery = query(collection(db, 'Policies'), orderBy('name', 'asc'))
      const updatedSnapshot = await getDocs(updatedPoliciesQuery)
      const updatedPolicies = updatedSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Policy[]
      setPolicies(updatedPolicies)
      setSearchResults(updatedPolicies)

    } catch (error) {
      console.error('Error saving policy:', error)
      setFormError('Failed to save policy. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteClick = (policy: Policy) => {
    setDeletingPolicy(policy)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deletingPolicy) return

    try {
      setIsDeleting(true)

      // Check if policy is linked to any contracts
      const contractsRef = collection(db, 'Contracts')
      const q = query(contractsRef, where('policiesId', '==', deletingPolicy.id))
      const querySnapshot = await getDocs(q)

      if (!querySnapshot.empty) {
        toast({
          title: "Cannot Delete Policy",
          description: "This policy is linked to existing contracts and cannot be deleted.",
          variant: "destructive",
        })
        return
      }

      // If no contracts are linked, proceed with deletion
      await deleteDoc(doc(db, 'Policies', deletingPolicy.id))

      // Update local state
      const updatedPolicies = policies.filter(p => p.id !== deletingPolicy.id)
      setPolicies(updatedPolicies)
      setSearchResults(updatedPolicies)

      toast({
        title: "Policy Deleted",
        description: "The policy has been successfully deleted.",
      })

      setDeleteDialogOpen(false)
      setDeletingPolicy(null)
    } catch (error) {
      console.error('Error deleting policy:', error)
      toast({
        title: "Error",
        description: "Failed to delete policy. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  // Add loading state to the component
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading policies...</p>
        </div>
      </div>
    )
  }

  // Add error state to the component
  if (error) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          {error}
          <Button
            variant="link"
            className="pl-2 underline"
            onClick={() => window.location.reload()}
          >
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Search Policies</CardTitle>
            {canEdit && (
              <Button onClick={handleAddNew}>
                <Plus className="mr-2 h-4 w-4" />
                Add New Policy
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Policy Name</Label>
                  <Input
                    id="name"
                    name="name"
                    value={searchParams.name}
                    onChange={handleInputChange}
                    placeholder="Search by policy name"
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={searchParams.status}
                    onValueChange={(value) => handleSelectChange(value, 'status')}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={searchParams.category}
                    onValueChange={(value) => handleSelectChange(value, 'category')}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.name}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Monthly Premium Range (R)</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      id="priceRange"
                      name="priceRange"
                      type="number"
                      value={searchParams.priceRange}
                      onChange={handleInputChange}
                      placeholder="Maximum"
                      className="h-11"
                      min="0"
                      step="50"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Cover Amount Range (R)</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      name="coverAmountMin"
                      type="number"
                      value={searchParams.coverAmountMin}
                      onChange={handleInputChange}
                      placeholder="Minimum"
                      className="h-11"
                      min="0"
                      step="1000"
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                      name="coverAmountMax"
                      type="number"
                      value={searchParams.coverAmountMax}
                      onChange={handleInputChange}
                      placeholder="Maximum"
                      className="h-11"
                      min="0"
                      step="1000"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Dependents Range</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      name="dependentsMin"
                      type="number"
                      value={searchParams.dependentsMin}
                      onChange={handleInputChange}
                      placeholder="Min"
                      className="h-11"
                      min="0"
                      max="10"
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                      name="dependentsMax"
                      type="number"
                      value={searchParams.dependentsMax}
                      onChange={handleInputChange}
                      placeholder="Max"
                      className="h-11"
                      min="0"
                      max="10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Sort By</Label>
                  <div className="flex gap-2">
                    <Select
                      value={searchParams.sortBy}
                      onValueChange={(value) => handleSelectChange(value, 'sortBy')}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                        <SelectItem value="coverAmount">Cover Amount</SelectItem>
                        <SelectItem value="maxDependents">Max Dependents</SelectItem>
                        <SelectItem value="status">Status</SelectItem>
                        <SelectItem value="category">Category</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={searchParams.sortOrder}
                      onValueChange={(value) => handleSelectChange(value, 'sortOrder')}
                    >
                      <SelectTrigger className="h-11 w-[100px]">
                        <SelectValue placeholder="Order" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asc">Asc</SelectItem>
                        <SelectItem value="desc">Desc</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={isSearching} className="min-w-[120px]">
                  {isSearching ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Search
                    </>
                  )}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleResetSearch}
                >
                  Reset Filters
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Search Results</span>
              <Badge variant="secondary">
                {searchResults.length} {searchResults.length === 1 ? 'item' : 'items'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Policy ID</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-accent"
                    onClick={() => handleSort('name')}
                  >
                    Name {searchParams.sortBy === 'name' && <ArrowUpDown className="inline h-4 w-4" />}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-accent"
                    onClick={() => handleSort('premium')}
                  >
                    Premium {searchParams.sortBy === 'premium' && <ArrowUpDown className="inline h-4 w-4" />}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-accent"
                    onClick={() => handleSort('coverAmount')}
                  >
                    Cover Amount {searchParams.sortBy === 'coverAmount' && <ArrowUpDown className="inline h-4 w-4" />}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-accent"
                    onClick={() => handleSort('maxDependents')}
                  >
                    Max Dependents {searchParams.sortBy === 'maxDependents' && <ArrowUpDown className="inline h-4 w-4" />}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-accent"
                    onClick={() => handleSort('status')}
                  >
                    Status {searchParams.sortBy === 'status' && <ArrowUpDown className="inline h-4 w-4" />}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-accent"
                    onClick={() => handleSort('category')}
                  >
                    Category {searchParams.sortBy === 'category' && <ArrowUpDown className="inline h-4 w-4" />}
                  </TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {searchResults.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No policies found matching your search criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  searchResults.map((policy) => (
                    <TableRow key={policy.id}>
                      <TableCell className="font-medium">{policy.id}</TableCell>
                      <TableCell>{policy.name}</TableCell>
                      <TableCell>R{policy.premium.toLocaleString()}</TableCell>
                      <TableCell>R{policy.coverAmount.toLocaleString()}</TableCell>
                      <TableCell>{policy.maxDependents}</TableCell>
                      <TableCell>
                        <Badge variant={policy.status === 'active' ? 'default' : 'secondary'}>
                          {policy.status.charAt(0).toUpperCase() + policy.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {categories.find(cat => cat.id === policy.categoryId)?.name || 'Uncategorized'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {canEdit && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(policy)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit policy</TooltipContent>
                            </Tooltip>
                          )}
                          {!linkedPolicies.has(policy.id) && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteClick(policy)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete policy</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto p-8">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl">
                {editingPolicy ? 'Edit Policy' : 'Add New Policy'}
                {isLoading && <Loader2 className="ml-2 h-4 w-4 inline animate-spin" />}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-8">
              {formError && (
                <Alert variant="destructive" className="mb-6">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}
              
              <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                <div className="space-y-3">
                  <Label htmlFor="id" className="text-base">Policy ID</Label>
                  <Input
                    id="id"
                    name="id"
                    value={formData.id}
                    disabled
                    className="h-11"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="name" className="text-base">Policy Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleFormInputChange}
                    placeholder="Enter policy name"
                    className="h-11"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="premium" className="text-base">Monthly Premium (R) *</Label>
                  <Input
                    id="premium"
                    name="premium"
                    type="number"
                    value={formData.premium}
                    onChange={handleFormInputChange}
                    min="0"
                    step="50"
                    className="h-11"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="coverAmount" className="text-base">Cover Amount (R) *</Label>
                  <Input
                    id="coverAmount"
                    name="coverAmount"
                    type="number"
                    value={formData.coverAmount}
                    onChange={handleFormInputChange}
                    min="0"
                    step="5000"
                    className="h-11"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="maxDependents" className="text-base">Maximum Dependents *</Label>
                  <Input
                    id="maxDependents"
                    name="maxDependents"
                    type="number"
                    value={formData.maxDependents}
                    onChange={handleFormInputChange}
                    min="0"
                    max="10"
                    className="h-11"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="status" className="text-base">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={handleFormStatusChange}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="category" className="text-base">Category *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.name}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="description" className="text-base">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleFormInputChange}
                  placeholder="Enter policy description"
                  className="min-h-[120px] resize-none p-4"
                />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-base">Features</Label>
                  {formData.features.length > 0 && (
                    <Badge variant="secondary" className="h-6">
                      {formData.features.length} {formData.features.length === 1 ? 'feature' : 'features'}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-3">
                  <Select
                    value={newFeature}
                    onValueChange={setNewFeature}
                  >
                    <SelectTrigger className="h-11 flex-1">
                      <SelectValue placeholder="Select a feature to add" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableFeatures
                        .filter(feature => !formData.features.includes(feature.id))
                        .map((feature) => (
                          <SelectItem 
                            key={feature.id} 
                            value={feature.name}
                          >
                            {feature.name}
                          </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    type="button" 
                    onClick={handleAddFeature}
                    variant="secondary"
                    className="h-11 px-6 min-w-[120px]"
                    disabled={!newFeature || isAddingFeature}
                  >
                    {isAddingFeature ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Feature
                      </>
                    )}
                  </Button>
                </div>
                {formData.features.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 mt-3 max-h-[200px] overflow-y-auto p-2">
                    {formData.features.map((featureId, index) => {
                      const feature = availableFeatures.find(f => f.id === featureId)
                      return (
                        <div key={featureId} className="flex items-center gap-2 bg-secondary/20 p-3 rounded-md hover:bg-secondary/30 transition-colors group">
                          <div className="flex-1">
                            <p className="font-medium">{feature?.name || 'Loading...'}</p>
                            {feature?.description && (
                              <p className="text-sm text-muted-foreground">{feature.description}</p>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveFeature(index)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <DialogFooter className="flex justify-end gap-3 pt-6 border-t">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isSaving}
                  className="h-11 px-6"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="h-11 px-8 min-w-[120px]"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {editingPolicy ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    editingPolicy ? 'Update Policy' : 'Create Policy'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Policy</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p>Are you sure you want to delete this policy?</p>
              <p className="text-sm text-muted-foreground mt-2">
                Policy Name: {deletingPolicy?.name}
              </p>
              <Alert className="mt-4" variant="destructive">
                <AlertTitle>Warning</AlertTitle>
                <AlertDescription>
                  This action cannot be undone. The policy will be permanently deleted.
                </AlertDescription>
              </Alert>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete Policy'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
    </TooltipProvider>
  )
}

