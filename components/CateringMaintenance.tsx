"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, Loader2, Plus, Pencil, Trash2, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import { collection, getDocs, query, orderBy, where, addDoc, doc, updateDoc, limit, setDoc, deleteDoc } from "firebase/firestore"
import { db } from "@/src/FirebaseConfg"
import { Checkbox } from "@/components/ui/checkbox"

type Feature = {
  id: string
  name: string
  description?: string
}

type Category = {
  id: string
  name: string
  date: Date
}

type CateringOption = {
  id: string
  name: string
  price: number
  description: string
  categoryId: string
  features: string[] // Array of feature IDs
  createdAt: Date
  isLinked: boolean
}

type SortField = 'name' | 'price' | 'categoryId' | 'createdAt'
type SortOrder = 'asc' | 'desc'

const ITEMS_PER_PAGE = 5

export function CateringMaintenance() {
  const [cateringOptions, setCateringOptions] = useState<CateringOption[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [features, setFeatures] = useState<Feature[]>([])
  const [searchParams, setSearchParams] = useState({
    name: "",
    categoryId: "all",
    priceRange: ""
  })
  const [searchResults, setSearchResults] = useState<CateringOption[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingOption, setEditingOption] = useState<CateringOption | null>(null)
  const [deletingOption, setDeletingOption] = useState<CateringOption | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [sortConfig, setSortConfig] = useState<{ field: SortField; order: SortOrder }>({
    field: 'name',
    order: 'asc'
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [generatedId, setGeneratedId] = useState<string>("")

  const [formData, setFormData] = useState<Omit<CateringOption, 'id' | 'createdAt' | 'isLinked'>>({
    name: "",
    price: 0,
    description: "",
    categoryId: "",
    features: []
  })

  // Check if catering option is linked to any contracts
  const checkContractDependencies = async (cateringId: string) => {
    try {
      const contractsRef = collection(db, 'Contracts')
      const q = query(
        contractsRef,
        where('cateringOptionIds', 'array-contains', cateringId)
      )
      const querySnapshot = await getDocs(q)
      return querySnapshot.size > 0
    } catch (error) {
      console.error('Error checking contract dependencies:', error)
      return false
    }
  }

  // Fetch catering options from Firestore
  useEffect(() => {
    const fetchCateringOptions = async () => {
      try {
        const cateringQuery = query(
          collection(db, 'catering'),
          orderBy('createdAt', 'desc')
        )
        const querySnapshot = await getDocs(cateringQuery)
        
        // Get all catering options and check their contract dependencies
        const cateringList = await Promise.all(querySnapshot.docs.map(async doc => {
          const data = doc.data()
          const isLinked = await checkContractDependencies(data.id)
          
          return {
            id: data.id,
            name: data.name,
            price: data.price,
            description: data.description,
            categoryId: data.categoryId,
            features: data.features || [], // Include features array
            createdAt: data.createdAt?.toDate() || new Date(),
            isLinked
          }
        }))

        setCateringOptions(cateringList)
        setSearchResults(cateringList)
      } catch (error) {
        console.error('Error fetching catering options:', error)
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load catering options. Please refresh the page."
        })
      }
    }

    fetchCateringOptions()
  }, [])

  // Fetch categories from Firestore
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const categoryQuery = query(
          collection(db, 'Category'),
          orderBy('date', 'desc')
        )
        const querySnapshot = await getDocs(categoryQuery)
        const categoryList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
          date: doc.data().date?.toDate() || new Date()
        }))
      
        setCategories(categoryList)
      } catch (error) {
        console.error('Error fetching categories:', error)
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load categories. Please refresh the page."
        })
      }
    }

    fetchCategories()
  }, [])

  // Add feature fetching effect
  useEffect(() => {
    const fetchFeatures = async () => {
      try {
        const featuresQuery = query(collection(db, 'Features'))
        const querySnapshot = await getDocs(featuresQuery)
        const featuresList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
          description: doc.data().description
        }))
        setFeatures(featuresList)
      } catch (error) {
        console.error('Error fetching features:', error)
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load features. Please refresh the page."
        })
      }
    }

    fetchFeatures()
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    if (name.startsWith("form")) {
      setFormData(prev => ({ ...prev, [name.replace("form", "").toLowerCase()]: value }))
    } else {
      setSearchParams(prev => ({ ...prev, [name]: value }))
    }
  }

  const handleSelectChange = (value: string, field: string) => {
    if (field === "formCategory") {
      setFormData(prev => ({ ...prev, categoryId: value }))
    } else {
      setSearchParams(prev => ({ ...prev, [field]: value }))
    }
  }

  const handleSort = (field: SortField) => {
    setSortConfig(prev => ({
      field,
      order: prev.field === field && prev.order === 'asc' ? 'desc' : 'asc'
    }))
  }

  const sortResults = (results: CateringOption[]) => {
    return [...results].sort((a, b) => {
      const aValue = a[sortConfig.field]
      const bValue = b[sortConfig.field]
      const modifier = sortConfig.order === 'asc' ? 1 : -1

      if (typeof aValue === 'string') {
        return aValue.localeCompare(String(bValue)) * modifier
      }
      return ((aValue as number) - (bValue as number)) * modifier
    })
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSearching(true)
    setCurrentPage(1)

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500))

    // Filter the mock data based on search parameters
    const filtered = cateringOptions.filter(option => {
      const nameMatch = option.name.toLowerCase().includes(searchParams.name.toLowerCase())
      const categoryMatch = searchParams.categoryId === "all" || option.categoryId === searchParams.categoryId
      const priceMatch = !searchParams.priceRange || option.price <= parseInt(searchParams.priceRange)

      return nameMatch && categoryMatch && priceMatch
    })

    setSearchResults(filtered)
    setIsSearching(false)
  }

  const handleEdit = (option: CateringOption) => {
    setEditingOption(option)
    setFormData({
      name: option.name,
      price: option.price,
      description: option.description,
      categoryId: option.categoryId,
      features: option.features || []
    })
    setIsDialogOpen(true)
  }

  const handleDeleteClick = async (option: CateringOption) => {
    try {
      // Check for contract dependencies first
      const hasContracts = await checkContractDependencies(option.id)
      
      if (hasContracts) {
        toast({
          variant: "destructive",
          title: "Cannot Delete",
          description: "This catering option is linked to existing contracts and cannot be deleted."
        })
        return
      }

      // If no contracts are linked, proceed with showing delete dialog
      setDeletingOption(option)
      setDeleteDialogOpen(true)
    } catch (error) {
      console.error('Error checking contract dependencies:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to check if this option can be deleted. Please try again."
      })
    }
  }

  const handleDelete = async () => {
    if (!deletingOption) return

    try {
      // Show loading state
      setIsSearching(true)

      // Check for contract dependencies
      const hasContracts = await checkContractDependencies(deletingOption.id)
      
      if (hasContracts) {
        toast({
          variant: "destructive",
          title: "Cannot Delete",
          description: "This catering option is linked to existing contracts and cannot be deleted."
        })
        setDeleteDialogOpen(false)
        return
      }

      // Proceed with deletion if no contracts are linked
      const docRef = doc(db, 'catering', deletingOption.id)
      await deleteDoc(docRef)

      // Update local state
      const newOptions = cateringOptions.filter(option => option.id !== deletingOption.id)
      setCateringOptions(newOptions)
      setSearchResults(newOptions)

      toast({
        title: "Success",
        description: `${deletingOption.name} has been deleted successfully.`
      })
    } catch (error) {
      console.error('Error deleting catering option:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete catering option. Please try again."
      })
    } finally {
      setIsSearching(false)
      setDeleteDialogOpen(false)
      setDeletingOption(null)
    }
  }

  // Function to generate next ID
  const generateNextId = async () => {
    try {
      const cateringRef = collection(db, 'catering')
      const querySnapshot = await getDocs(cateringRef)
      
      // Get all existing IDs
      const existingIds = querySnapshot.docs
        .map(doc => doc.data().id || '')
        .filter(id => id.startsWith('CAT'))
        .map(id => parseInt(id.substring(3)))
        .filter(num => !isNaN(num))

      // Find the highest number
      const highestNumber = existingIds.length > 0 ? Math.max(...existingIds) : 0
      
      // Generate next ID
      const nextNumber = highestNumber + 1
      const nextId = `CAT${String(nextNumber).padStart(3, '0')}`
      
      return nextId
    } catch (error) {
      console.error('Error generating ID:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate ID. Please try again."
      })
      return null
    }
  }

  // Update dialog open handler
  const handleAddNew = async () => {
    const newId = await generateNextId()
    if (newId) {
      setGeneratedId(newId)
      setEditingOption(null)
      setFormData({ name: "", price: 0, description: "", categoryId: "", features: [] })
      setIsDialogOpen(true)
    }
  }

  // Update handleSubmit to check for linked contracts
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!formData.name || !formData.categoryId || formData.price <= 0) {
      setFormError("Please fill in all required fields with valid values")
      return
    }

    try {
      const timestamp = new Date()
      const id = editingOption ? editingOption.id : generatedId
      const isLinked = await checkContractDependencies(id)

      const newOption = {
        id,
        name: formData.name,
        price: Number(formData.price),
        description: formData.description,
        categoryId: formData.categoryId,
        features: formData.features,
        createdAt: timestamp,
        isLinked
      }

      if (!editingOption) {
        // Add new catering option
        const docRef = doc(db, 'catering', generatedId)
        await setDoc(docRef, newOption)
        toast({
          title: "Success",
          description: "Catering option added successfully"
        })
      } else {
        // Update existing catering option
        const docRef = doc(db, 'catering', editingOption.id)
        await setDoc(docRef, {
          ...newOption,
          id: editingOption.id,
          createdAt: editingOption.createdAt,
          updatedAt: timestamp
        }, { merge: true })
        
        toast({
          title: "Success",
          description: "Catering option updated successfully"
        })
      }

      // Refresh the catering options list with updated isLinked status
      const cateringQuery = query(collection(db, 'catering'), orderBy('createdAt', 'desc'))
      const querySnapshot = await getDocs(cateringQuery)
      const cateringList = await Promise.all(querySnapshot.docs.map(async doc => {
        const data = doc.data()
        const isLinked = await checkContractDependencies(data.id)
        
        return {
          id: data.id,
          name: data.name,
          price: data.price,
          description: data.description,
          categoryId: data.categoryId,
          features: data.features || [],
          createdAt: data.createdAt?.toDate() || new Date(),
          isLinked
        }
      }))

      setCateringOptions(cateringList)
      setSearchResults(cateringList)

      // Reset form and close dialog
      setFormData({ name: "", price: 0, description: "", categoryId: "", features: [] })
      setEditingOption(null)
      setGeneratedId("")
      setIsDialogOpen(false)
    } catch (error) {
      console.error('Error saving catering option:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save catering option. Please try again."
      })
    }
  }

  // Pagination
  const totalPages = Math.ceil(searchResults.length / ITEMS_PER_PAGE)
  const paginatedResults = sortResults(searchResults).slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  // Update the delete dialog content
  const DeleteConfirmationDialog = () => (
    <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Deletion</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p>Are you sure you want to delete "{deletingOption?.name}"?</p>
          <Alert variant="default">
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>
              This action cannot be undone. The system will check for any linked contracts before proceeding.
            </AlertDescription>
          </Alert>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isSearching}>
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleDelete}
            disabled={isSearching}
          >
            {isSearching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              'Delete'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  // Add feature handling functions
  const handleFeatureToggle = (featureId: string) => {
    setFormData(prev => {
      const features = prev.features || []
      if (features.includes(featureId)) {
        return { ...prev, features: features.filter(id => id !== featureId) }
      } else {
        return { ...prev, features: [...features, featureId] }
      }
    })
  }

  return (
    <TooltipProvider>
      <div className="space-y-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Search Catering Options</CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleAddNew}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add New Option
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingOption ? 'Edit Catering Option' : 'Add New Catering Option'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {formError && (
                    <Alert variant="destructive">
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{formError}</AlertDescription>
                    </Alert>
                  )}
                  {!editingOption && (
                    <div className="hidden">
                      <Label htmlFor="formId">Package ID</Label>
                      <Input
                        id="formId"
                        name="formId"
                        value={generatedId}
                        disabled
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="formName">Package Name *</Label>
                    <Input
                      id="formName"
                      name="formName"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="Enter package name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="formCategory">Category *</Label>
                    <Select
                      value={formData.categoryId}
                      onValueChange={(value) => handleSelectChange(value, "formCategory")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="formPrice">Price *</Label>
                    <Input
                      id="formPrice"
                      name="formPrice"
                      type="number"
                      value={formData.price}
                      onChange={handleInputChange}
                      min="0"
                      step="100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="formDescription">Description</Label>
                    <Textarea
                      id="formDescription"
                      name="formDescription"
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="Enter package description"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Features</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {features.map((feature) => (
                        <div key={feature.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={feature.id}
                            checked={formData.features.includes(feature.id)}
                            onCheckedChange={() => handleFeatureToggle(feature.id)}
                          />
                          <Label htmlFor={feature.id} className="cursor-pointer">
                            {feature.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button type="submit" className="w-full">
                    {editingOption ? 'Update' : 'Add'} Catering Option
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="name">Package Name</Label>
                  <Input
                    id="name"
                    name="name"
                    value={searchParams.name}
                    onChange={handleInputChange}
                    placeholder="Search by package name"
                  />
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={searchParams.categoryId}
                    onValueChange={(value) => handleSelectChange(value, "category")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="priceRange">Max Price Range</Label>
                  <Input
                    id="priceRange"
                    name="priceRange"
                    type="number"
                    value={searchParams.priceRange}
                    onChange={handleInputChange}
                    placeholder="Enter maximum price"
                    min="0"
                    step="100"
                  />
                </div>
              </div>
              <Button type="submit" disabled={isSearching}>
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
                  <TableHead>Package ID</TableHead>
                  <TableHead onClick={() => handleSort('name')} className="cursor-pointer hover:bg-accent">
                    Name {sortConfig.field === 'name' && <ArrowUpDown className="inline h-4 w-4" />}
                  </TableHead>
                  <TableHead onClick={() => handleSort('categoryId')} className="cursor-pointer hover:bg-accent">
                    Category {sortConfig.field === 'categoryId' && <ArrowUpDown className="inline h-4 w-4" />}
                  </TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead onClick={() => handleSort('price')} className="cursor-pointer hover:bg-accent">
                    Price {sortConfig.field === 'price' && <ArrowUpDown className="inline h-4 w-4" />}
                  </TableHead>
                  <TableHead>Features</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedResults.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No catering options found matching your search criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedResults.map((option) => (
                    <TableRow key={option.id}>
                      <TableCell className="font-medium">{option.id}</TableCell>
                      <TableCell>{option.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {categories.find(cat => cat.id === option.categoryId)?.name || 'Unknown Category'}
                        </Badge>
                      </TableCell>
                      <TableCell>{option.description}</TableCell>
                      <TableCell>R{option.price.toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {option.features?.map(featureId => {
                            const feature = features.find(f => f.id === featureId)
                            return feature ? (
                              <Badge key={featureId} variant="secondary" className="text-xs">
                                {feature.name}
                              </Badge>
                            ) : null
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(option)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit option</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteClick(option)}
                                disabled={option.isLinked}
                              >
                                <Trash2 className={`h-4 w-4 ${option.isLinked ? 'text-gray-300' : 'text-red-500'}`} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {option.isLinked ? 'Cannot delete - linked to contracts' : 'Delete option'}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {searchResults.length > 0 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, searchResults.length)} of {searchResults.length} entries
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="text-sm">
                    Page {currentPage} of {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <DeleteConfirmationDialog />
      </div>
    </TooltipProvider>
  )
}

