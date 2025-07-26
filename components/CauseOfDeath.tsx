"use client"

import { useState, useEffect } from "react"
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where } from "firebase/firestore"
import { db } from "@/src/FirebaseConfg"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"
import { Loader2, Plus, Search, Eye, Trash } from "lucide-react"

interface CauseOfDeath {
  id: string
  option: string
  waitingPeriod: number
}

interface DialogState {
  isOpen: boolean
  type: 'add' | 'edit' | 'delete' | 'view' | null
  data: CauseOfDeath | null
}

export function CauseOfDeath() {
  const [searchOption, setSearchOption] = useState("")
  const [searchWaitingPeriod, setSearchWaitingPeriod] = useState<string>("")
  const [options, setOptions] = useState<CauseOfDeath[]>([])
  const [loading, setLoading] = useState(false)
  const [dialog, setDialog] = useState<DialogState>({
    isOpen: false,
    type: null,
    data: null
  })
  const [newOption, setNewOption] = useState({
    option: "",
    waitingPeriod: "0"
  })

  useEffect(() => {
    fetchOptions()
  }, [])

  const fetchOptions = async () => {
    try {
      setLoading(true)
      const optionsRef = collection(db, 'CauseOfDeath')
      let queryRef = query(optionsRef)

      if (searchOption || searchWaitingPeriod) {
        const conditions = []
        if (searchOption) {
          conditions.push(where('option', '>=', searchOption))
          conditions.push(where('option', '<=', searchOption + '\uf8ff'))
        }
        if (searchWaitingPeriod) {
          conditions.push(where('waitingPeriod', '==', parseInt(searchWaitingPeriod)))
        }
        queryRef = query(optionsRef, ...conditions)
      }

      const snapshot = await getDocs(queryRef)
      const optionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CauseOfDeath[]
      setOptions(optionsData)
    } catch (error) {
      console.error('Error fetching options:', error)
      toast({
        title: "Error",
        description: "Failed to fetch options. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    try {
      setLoading(true)
      const optionsRef = collection(db, 'CauseOfDeath')
      let queryRef = query(optionsRef)

      if (searchOption || searchWaitingPeriod) {
        const conditions = []
        if (searchOption) {
          conditions.push(where('option', '>=', searchOption))
          conditions.push(where('option', '<=', searchOption + '\uf8ff'))
        }
        if (searchWaitingPeriod) {
          conditions.push(where('waitingPeriod', '==', parseInt(searchWaitingPeriod)))
        }
        queryRef = query(optionsRef, ...conditions)
      }

      const snapshot = await getDocs(queryRef)
      const optionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CauseOfDeath[]
      setOptions(optionsData)
    } catch (error) {
      console.error('Error searching options:', error)
      toast({
        title: "Error",
        description: "Failed to search options. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    try {
      if (!newOption.option.trim()) {
        toast({
          title: "Error",
          description: "Option name is required",
          variant: "destructive"
        })
        return
      }

      const optionsRef = collection(db, 'CauseOfDeath')
      await addDoc(optionsRef, {
        option: newOption.option.trim(),
        waitingPeriod: parseInt(newOption.waitingPeriod)
      })

      toast({
        title: "Success",
        description: "Option added successfully"
      })

      setDialog({ isOpen: false, type: null, data: null })
      setNewOption({ option: "", waitingPeriod: "0" })
      fetchOptions()
    } catch (error) {
      console.error('Error adding option:', error)
      toast({
        title: "Error",
        description: "Failed to add option. Please try again.",
        variant: "destructive"
      })
    }
  }

  const handleEdit = async () => {
    try {
      if (!dialog.data || !dialog.data.id) return

      if (!newOption.option.trim()) {
        toast({
          title: "Error",
          description: "Option name is required",
          variant: "destructive"
        })
        return
      }

      const optionRef = doc(db, 'CauseOfDeath', dialog.data.id)
      await updateDoc(optionRef, {
        option: newOption.option.trim(),
        waitingPeriod: parseInt(newOption.waitingPeriod)
      })

      toast({
        title: "Success",
        description: "Option updated successfully"
      })

      setDialog({ isOpen: false, type: null, data: null })
      setNewOption({ option: "", waitingPeriod: "0" })
      fetchOptions()
    } catch (error) {
      console.error('Error updating option:', error)
      toast({
        title: "Error",
        description: "Failed to update option. Please try again.",
        variant: "destructive"
      })
    }
  }

  const handleDelete = async () => {
    try {
      if (!dialog.data || !dialog.data.id) return

      const optionRef = doc(db, 'CauseOfDeath', dialog.data.id)
      await deleteDoc(optionRef)

      toast({
        title: "Success",
        description: "Option deleted successfully"
      })

      setDialog({ isOpen: false, type: null, data: null })
      fetchOptions()
    } catch (error) {
      console.error('Error deleting option:', error)
      toast({
        title: "Error",
        description: "Failed to delete option. Please try again.",
        variant: "destructive"
      })
    }
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Cause of Death Management</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <div>
          <Label htmlFor="search-option">Option</Label>
          <Input
            id="search-option"
            placeholder="Search by option name"
            value={searchOption}
            onChange={(e) => setSearchOption(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="search-waiting-period">Waiting Period (Months)</Label>
          <Input
            id="search-waiting-period"
            type="number"
            min="0"
            max="12"
            placeholder="Search by waiting period"
            value={searchWaitingPeriod}
            onChange={(e) => setSearchWaitingPeriod(e.target.value)}
          />
        </div>
        <div className="flex items-end gap-2">
          <Button onClick={handleSearch} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4 mr-2" />
            )}
            Search
          </Button>
          <Button
            onClick={() => {
              setDialog({
                isOpen: true,
                type: 'add',
                data: null
              })
              setNewOption({ option: "", waitingPeriod: "0" })
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Option
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Actions</TableHead>
            <TableHead>Option</TableHead>
            <TableHead>Waiting Period (Months)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {options.map((option) => (
            <TableRow key={option.id}>
              <TableCell>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setDialog({
                        isOpen: true,
                        type: 'view',
                        data: option
                      })
                      setNewOption({
                        option: option.option,
                        waitingPeriod: option.waitingPeriod.toString()
                      })
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setDialog({
                        isOpen: true,
                        type: 'delete',
                        data: option
                      })
                    }}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
              <TableCell>{option.option}</TableCell>
              <TableCell>{option.waitingPeriod}</TableCell>
            </TableRow>
          ))}
          {options.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="text-center py-4">
                No options found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={dialog.isOpen} onOpenChange={(isOpen) => {
        if (!isOpen) {
          setDialog({ isOpen: false, type: null, data: null })
          setNewOption({ option: "", waitingPeriod: "0" })
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog.type === 'add' ? 'Add New Option' : 
               dialog.type === 'edit' ? 'Edit Option' :
               dialog.type === 'delete' ? 'Delete Option' :
               dialog.type === 'view' ? 'View Option' : ''}
            </DialogTitle>
            <DialogDescription>
              {dialog.type === 'delete' 
                ? 'Are you sure you want to delete this option? This action cannot be undone.'
                : dialog.type === 'view'
                ? 'View the details for this cause of death option.'
                : 'Enter the details for the cause of death option.'}
            </DialogDescription>
          </DialogHeader>

          {dialog.type !== 'delete' && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="option-name">Option Name</Label>
                <Input
                  id="option-name"
                  placeholder="Enter option name"
                  value={newOption.option}
                  onChange={(e) => setNewOption(prev => ({
                    ...prev,
                    option: e.target.value
                  }))}
                  readOnly={dialog.type === 'view'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="waiting-period">Waiting Period (Months)</Label>
                {dialog.type === 'view' ? (
                  <Input
                    id="waiting-period"
                    value={`${newOption.waitingPeriod} months`}
                    readOnly
                  />
                ) : (
                  <Select
                    value={newOption.waitingPeriod}
                    onValueChange={(value) => setNewOption(prev => ({
                      ...prev,
                      waitingPeriod: value
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select waiting period" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 13 }, (_, i) => (
                        <SelectItem key={i} value={i.toString()}>
                          {i} months
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            {dialog.type === 'view' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setDialog({ isOpen: false, type: null, data: null })}
                >
                  Close
                </Button>
                <Button 
                  onClick={() => setDialog(prev => ({
                    ...prev,
                    type: 'edit'
                  }))}
                >
                  Edit
                </Button>
              </>
            )}
            {dialog.type === 'add' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setDialog({ isOpen: false, type: null, data: null })}
                >
                  Cancel
                </Button>
                <Button onClick={handleAdd}>Save</Button>
              </>
            )}
            {dialog.type === 'edit' && (
              <Button onClick={handleEdit}>Save Changes</Button>
            )}
            {dialog.type === 'delete' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setDialog({ isOpen: false, type: null, data: null })}
                >
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDelete}>
                  Delete
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 