import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, X } from "lucide-react"

type SearchParams = {
  contractNumber: string
  claimId: string
  dateFrom: string
  dateTo: string
  status: string
  claimantName: string
  claimType: string
}

interface SearchFilterProps {
  searchParams: SearchParams
  setSearchParams: (params: SearchParams) => void
}

export function SearchFilter({ searchParams, setSearchParams }: SearchFilterProps) {
  const handleSearchChange = (field: keyof SearchParams, value: string) => {
    setSearchParams({ ...searchParams, [field]: value })
  }

  const clearSearch = () => {
    setSearchParams({
      contractNumber: "",
      claimId: "",
      dateFrom: "",
      dateTo: "",
      status: "all",
      claimantName: "",
      claimType: "all"
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Claims Search</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Contract Number</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by contract..."
                  value={searchParams.contractNumber}
                  onChange={(e) => handleSearchChange('contractNumber', e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Claim ID</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by claim ID..."
                  value={searchParams.claimId}
                  onChange={(e) => handleSearchChange('claimId', e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Claimant Name</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name..."
                  value={searchParams.claimantName}
                  onChange={(e) => handleSearchChange('claimantName', e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Date From</Label>
              <Input
                type="date"
                value={searchParams.dateFrom}
                onChange={(e) => handleSearchChange('dateFrom', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Date To</Label>
              <Input
                type="date"
                value={searchParams.dateTo}
                onChange={(e) => handleSearchChange('dateTo', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={searchParams.status}
                onValueChange={(value) => handleSearchChange('status', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Under Investigation">Under Investigation</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                  <SelectItem value="Paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <Select
              value={searchParams.claimType}
              onValueChange={(value) => handleSearchChange('claimType', value)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by claim type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Medical">Medical</SelectItem>
                <SelectItem value="Property">Property</SelectItem>
                <SelectItem value="Liability">Liability</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={clearSearch}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Clear Filters
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 