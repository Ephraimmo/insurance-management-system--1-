import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, Plus, Search, Pencil, Trash2, X, AlertCircle } from "lucide-react"
import { collection, getDocs, query, orderBy, doc, setDoc, deleteDoc } from "firebase/firestore"
import { db } from "@/src/FirebaseConfg"
import { toast } from "@/components/ui/use-toast"
import { format } from "date-fns"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type Category = {
  id: string
  name: string
  date: Date
}

type SearchParams = {
  name: string
  id: string
  date: string
}

export function CategoryMaintenance() {
  const [categories, setCategories] = useState<Category[]>([])
  const [linkedCategories, setLinkedCategories] = useState<Set<string>>(new Set())
  const [searchParams, setSearchParams] = useState<SearchParams>({
    name: "",
    id: "",
    date: ""
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [formData, setFormData] = useState({ name: "" })
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchCategories()
  }, [])

  const checkLinkedCategories = async () => {
    try {
      const cateringRef = collection(db, 'catering')
      const querySnapshot = await getDocs(cateringRef)
      const linkedCategoryIds = new Set<string>()
      
      querySnapshot.forEach(doc => {
        const data = doc.data()
        if (data.categoryId) {
          linkedCategoryIds.add(data.categoryId)
        }
      })
      
      setLinkedCategories(linkedCategoryIds)
    } catch (error) {
      console.error('Error checking linked categories:', error)
    }
  }

  const fetchCategories = async () => {
    try {
      setIsLoading(true)
      const categoryQuery = query(collection(db, 'Category'), orderBy('date', 'desc'))
      const querySnapshot = await getDocs(categoryQuery)
      const categoryList = querySnapshot.docs.map(doc => ({
        id: doc.data().id,
        name: doc.data().name,
        date: doc.data().date?.toDate() || new Date()
      }))
      setCategories(categoryList)
      await checkLinkedCategories()
    } catch (error) {
      console.error('Error fetching categories:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load categories"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.name.trim()) {
      setError("Category name is required")
      return
    }

    try {
      setIsSaving(true)
      const timestamp = new Date()
      const categoryData = {
        name: formData.name,
        date: timestamp
      }

      if (editingCategory) {
        await setDoc(doc(db, 'Category', editingCategory.id), categoryData)
        toast({
          title: "Success",
          description: "Category updated successfully"
        })
      } else {
        const newId = `CAT${String(categories.length + 1).padStart(3, '0')}`
        await setDoc(doc(db, 'Category', newId), {
          ...categoryData,
          id: newId
        })
        toast({
          title: "Success",
          description: "Category added successfully"
        })
      }

      setFormData({ name: "" })
      setEditingCategory(null)
      setIsDialogOpen(false)
      fetchCategories()
    } catch (error) {
      console.error('Error saving category:', error)
      setError("Failed to save category")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (category: Category) => {
    if (window.confirm('Are you sure you want to delete this category?')) {
      try {
        await deleteDoc(doc(db, 'Category', category.id))
        toast({
          title: "Success",
          description: "Category deleted successfully"
        })
        fetchCategories()
      } catch (error) {
        console.error('Error deleting category:', error)
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to delete category"
        })
      }
    }
  }

  const handleSearchChange = (field: keyof SearchParams, value: string) => {
    setSearchParams(prev => ({ ...prev, [field]: value }))
  }

  const clearSearch = () => {
    setSearchParams({ name: "", id: "", date: "" })
  }

  const filteredCategories = categories.filter(category => {
    const nameMatch = category.name.toLowerCase().includes(searchParams.name.toLowerCase())
    const idMatch = category.id.toLowerCase().includes(searchParams.id.toLowerCase())
    const dateMatch = searchParams.date 
      ? format(category.date, 'yyyy-MM-dd') === searchParams.date
      : true

    return nameMatch && idMatch && dateMatch
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Category Maintenance</CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingCategory(null)
                setFormData({ name: "" })
              }}>
                <Plus className="mr-2 h-4 w-4" />
                Add Category
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCategory ? 'Edit Category' : 'Add New Category'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Input
                    placeholder="Category name"
                    value={formData.name}
                    onChange={(e) => setFormData({ name: e.target.value })}
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {editingCategory ? 'Updating...' : 'Adding...'}
                      </>
                    ) : (
                      editingCategory ? 'Update Category' : 'Add Category'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name..."
                  value={searchParams.name}
                  onChange={(e) => handleSearchChange('name', e.target.value)}
                  className="pl-8"
                />
              </div>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by ID..."
                  value={searchParams.id}
                  onChange={(e) => handleSearchChange('id', e.target.value)}
                  className="pl-8"
                />
              </div>
              <div className="relative">
                <Input
                  type="date"
                  value={searchParams.date}
                  onChange={(e) => handleSearchChange('date', e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            {(searchParams.name || searchParams.id || searchParams.date) && (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSearch}
                  className="flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Clear Filters
                </Button>
              </div>
            )}

            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Date Added</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCategories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center">
                        No categories found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCategories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell>{category.id}</TableCell>
                        <TableCell>{category.name}</TableCell>
                        <TableCell>{format(category.date, 'dd/MM/yyyy')}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingCategory(category)
                                setFormData({ name: category.name })
                                setIsDialogOpen(true)
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {!linkedCategories.has(category.id) ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(category)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            ) : (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex h-8 w-8 items-center justify-center text-muted-foreground">
                                      <AlertCircle className="h-4 w-4" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Cannot delete: Category is linked to one or more catering options</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 