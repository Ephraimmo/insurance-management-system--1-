"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function Customers() {
  const [showAddCustomerDialog, setShowAddCustomerDialog] = useState(false)

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Customer Management</CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                Manage customer information, interactions, and support requests here.
              </p>
            </div>
            <Button
              variant="default"
              onClick={() => setShowAddCustomerDialog(true)}
            >
              Add Customer
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Add your customer list/table here */}
          <p>Customer list will be displayed here</p>
        </CardContent>
      </Card>

      <Dialog open={showAddCustomerDialog} onOpenChange={setShowAddCustomerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
          </DialogHeader>
          <form className="space-y-4">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" placeholder="Enter customer name" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="Enter email address" />
            </div>
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" placeholder="Enter phone number" />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddCustomerDialog(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Add Customer</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
} 