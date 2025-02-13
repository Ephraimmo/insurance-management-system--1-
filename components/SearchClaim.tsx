"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

// Mock data for demonstration
const mockClaims = [
  { id: 1, policyNumber: "POL-001", claimType: "Accident", incidentDate: "2023-05-15", status: "Pending" },
  { id: 2, policyNumber: "POL-002", claimType: "Theft", incidentDate: "2023-06-20", status: "Approved" },
  { id: 3, policyNumber: "POL-003", claimType: "Natural Disaster", incidentDate: "2023-07-10", status: "Under Review" },
]

export function SearchClaim() {
  const [searchTerm, setSearchTerm] = useState("")
  const [searchResults, setSearchResults] = useState(mockClaims)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // Filter claims based on search term
    const results = mockClaims.filter(
      (claim) =>
        claim.policyNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        claim.claimType.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    setSearchResults(results)
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Search Claims</h2>
      <form onSubmit={handleSearch} className="mb-4">
        <div className="flex gap-2">
          <div className="flex-grow">
            <Label htmlFor="searchTerm" className="sr-only">
              Search Term
            </Label>
            <Input
              id="searchTerm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by policy number or claim type"
            />
          </div>
          <Button type="submit">Search</Button>
        </div>
      </form>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Policy Number</TableHead>
            <TableHead>Claim Type</TableHead>
            <TableHead>Incident Date</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {searchResults.map((claim) => (
            <TableRow key={claim.id}>
              <TableCell>{claim.policyNumber}</TableCell>
              <TableCell>{claim.claimType}</TableCell>
              <TableCell>{claim.incidentDate}</TableCell>
              <TableCell>{claim.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

