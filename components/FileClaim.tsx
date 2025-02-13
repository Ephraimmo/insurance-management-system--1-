"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function FileClaim() {
  const [formData, setFormData] = useState({
    policyNumber: "",
    claimType: "",
    incidentDate: "",
    description: "",
    claimAmount: "",
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prevState) => ({
      ...prevState,
      [name]: value,
    }))
  }

  const handleSelectChange = (value: string) => {
    setFormData((prevState) => ({
      ...prevState,
      claimType: value,
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Here you would typically send the form data to your backend API
    console.log("Claim submitted:", formData)
    // Reset form after submission
    setFormData({
      policyNumber: "",
      claimType: "",
      incidentDate: "",
      description: "",
      claimAmount: "",
    })
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4">File a Claim</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="policyNumber">Policy Number</Label>
          <Input
            id="policyNumber"
            name="policyNumber"
            value={formData.policyNumber}
            onChange={handleInputChange}
            required
          />
        </div>
        <div>
          <Label htmlFor="claimType">Claim Type</Label>
          <Select onValueChange={handleSelectChange} value={formData.claimType}>
            <SelectTrigger>
              <SelectValue placeholder="Select claim type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="accident">Accident</SelectItem>
              <SelectItem value="theft">Theft</SelectItem>
              <SelectItem value="natural_disaster">Natural Disaster</SelectItem>
              <SelectItem value="medical">Medical</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="incidentDate">Incident Date</Label>
          <Input
            id="incidentDate"
            name="incidentDate"
            type="date"
            value={formData.incidentDate}
            onChange={handleInputChange}
            required
          />
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            required
          />
        </div>
        <div>
          <Label htmlFor="claimAmount">Claim Amount</Label>
          <Input
            id="claimAmount"
            name="claimAmount"
            type="number"
            value={formData.claimAmount}
            onChange={handleInputChange}
            required
          />
        </div>
        <Button type="submit">Submit Claim</Button>
      </form>
    </div>
  )
}

