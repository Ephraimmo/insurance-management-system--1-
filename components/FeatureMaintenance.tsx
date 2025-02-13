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
import { Label } from "@/components/ui/label"
import { format } from "date-fns"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type Feature = {
  id: string
  name: string
  date: Date
}

type SearchParams = {
  name: string
  id: string
  date: string
}

export function FeatureMaintenance() {
  const [features, setFeatures] = useState<Feature[]>([])
  const [linkedFeatures, setLinkedFeatures] = useState<Set<string>>(new Set())
  const [searchParams, setSearchParams] = useState<SearchParams>({
    name: "",
    id: "",
    date: ""
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingFeature, setEditingFeature] = useState<Feature | null>(null)
  const [formData, setFormData] = useState({ name: "" })
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchFeatures()
  }, [])

  const checkLinkedFeatures = async () => {
    try {
      const policiesRef = collection(db, 'Policies')
      const querySnapshot = await getDocs(policiesRef)
      const linkedFeatureIds = new Set<string>()
      
      querySnapshot.forEach(doc => {
        const data = doc.data()
        if (data.features && Array.isArray(data.features)) {
          data.features.forEach((featureId: string) => {
            linkedFeatureIds.add(featureId)
          })
        }
      })
      
      setLinkedFeatures(linkedFeatureIds)
    } catch (error) {
      console.error('Error checking linked features:', error)
    }
  }

  const fetchFeatures = async () => {
    try {
      setIsLoading(true)
      const featureQuery = query(collection(db, 'features'), orderBy('date', 'desc'))
      const querySnapshot = await getDocs(featureQuery)
      const featureList = querySnapshot.docs.map(doc => ({
        id: doc.data().id,
        name: doc.data().name,
        date: doc.data().date?.toDate() || new Date()
      }))
      setFeatures(featureList)
      await checkLinkedFeatures()
    } catch (error) {
      console.error('Error fetching features:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load features"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.name.trim()) {
      setError("Feature name is required")
      return
    }

    try {
      setIsSaving(true)
      const timestamp = new Date()
      const featureData = {
        name: formData.name,
        date: timestamp
      }

      if (editingFeature) {
        await setDoc(doc(db, 'features', editingFeature.id), featureData)
        toast({
          title: "Success",
          description: "Feature updated successfully"
        })
      } else {
        const newId = `FEX${String(features.length + 1).padStart(3, '0')}`
        await setDoc(doc(db, 'features', newId), {
          ...featureData,
          id: newId
        })
        toast({
          title: "Success",
          description: "Feature added successfully"
        })
      }

      setFormData({ name: "" })
      setEditingFeature(null)
      setIsDialogOpen(false)
      fetchFeatures()
    } catch (error) {
      console.error('Error saving feature:', error)
      setError("Failed to save feature")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (feature: Feature) => {
    if (window.confirm('Are you sure you want to delete this feature?')) {
      try {
        await deleteDoc(doc(db, 'features', feature.id))
        toast({
          title: "Success",
          description: "Feature deleted successfully"
        })
        fetchFeatures()
      } catch (error) {
        console.error('Error deleting feature:', error)
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to delete feature"
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

  const filteredFeatures = features.filter(feature => {
    const nameMatch = feature.name.toLowerCase().includes(searchParams.name.toLowerCase())
    const idMatch = feature.id.toLowerCase().includes(searchParams.id.toLowerCase())
    const dateMatch = searchParams.date 
      ? format(feature.date, 'yyyy-MM-dd') === searchParams.date
      : true

    return nameMatch && idMatch && dateMatch
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Feature Maintenance</CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingFeature(null)
                setFormData({ name: "" })
              }}>
                <Plus className="mr-2 h-4 w-4" />
                Add Feature
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingFeature ? 'Edit Feature' : 'Add New Feature'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="name">Feature Name</Label>
                  <Input
                    id="name"
                    placeholder="Feature name"
                    value={formData.name}
                    onChange={(e) => setFormData({ name: e.target.value })}
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {editingFeature ? 'Updating...' : 'Adding...'}
                      </>
                    ) : (
                      editingFeature ? 'Update Feature' : 'Add Feature'
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
                  {filteredFeatures.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center">
                        No features found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredFeatures.map((feature) => (
                      <TableRow key={feature.id}>
                        <TableCell>{feature.id}</TableCell>
                        <TableCell>{feature.name}</TableCell>
                        <TableCell>{format(feature.date, 'dd/MM/yyyy')}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingFeature(feature)
                                setFormData({
                                  name: feature.name
                                })
                                setIsDialogOpen(true)
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {!linkedFeatures.has(feature.id) ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(feature)}
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
                                    <p>Cannot delete: Feature is linked to one or more policies</p>
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