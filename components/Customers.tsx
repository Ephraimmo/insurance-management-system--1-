import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"

export function Customers() {
  const [showAddCustomerDialog, setShowAddCustomerDialog] = useState(false)

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Customer Management</h2>
      <p>Manage customer information, interactions, and support requests here.</p>
      <Button 
        id="Add Customer"
        onClick={() => setShowAddCustomerDialog(true)}
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Customer
      </Button>
    </div>
  )
}

