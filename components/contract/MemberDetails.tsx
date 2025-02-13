import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MainMemberForm } from "./MainMemberForm"

type Member = {
  name: string
  relation: string
  beneficiary: boolean
  idNumber: string
  idDocument: File | null
}

type MemberDetailsProps = {
  members: Member[]
  updateData: (data: { members: Member[] }) => void
}

export function MemberDetails({ members, updateData }: MemberDetailsProps) {
  const [currentMember, setCurrentMember] = useState<Member>({
    name: "",
    relation: "",
    beneficiary: false,
    idNumber: "",
    idDocument: null,
  })
  const [fileName, setFileName] = useState<string | null>(null)

  const handleAddMember = () => {
    if (currentMember.name && currentMember.relation && currentMember.idNumber && currentMember.idDocument) {
      updateData({ members: [...members, currentMember] })
      setCurrentMember({ name: "", relation: "", beneficiary: false, idNumber: "", idDocument: null })
      setFileName(null)
    }
  }

  const handleRemoveMember = (index: number) => {
    const newMembers = members.filter((_, i) => i !== index)
    updateData({ members: newMembers })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setCurrentMember({ ...currentMember, idDocument: e.target.files[0] })
      setFileName(e.target.files[0].name)
    }
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Add Members (up to 15)</h3>
      <div className="space-y-4 mb-6">
        <div>
          <Label htmlFor="memberName">Name</Label>
          <Input
            id="memberName"
            value={currentMember.name}
            onChange={(e) => setCurrentMember({ ...currentMember, name: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="memberRelation">Relation</Label>
          <Select
            value={currentMember.relation}
            onValueChange={(value) => setCurrentMember({ ...currentMember, relation: value })}
          >
            <SelectTrigger id="memberRelation">
              <SelectValue placeholder="Select relation" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="spouse">Spouse</SelectItem>
              <SelectItem value="child">Child</SelectItem>
              <SelectItem value="parent">Parent</SelectItem>
              <SelectItem value="sibling">Sibling</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="memberIdNumber">ID Number</Label>
          <Input
            id="memberIdNumber"
            value={currentMember.idNumber}
            onChange={(e) => setCurrentMember({ ...currentMember, idNumber: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="memberIdDocument">ID Document</Label>
          <Input id="memberIdDocument" type="file" onChange={handleFileChange} className="hidden" />
          <div className="flex items-center mt-2">
            <Button onClick={() => document.getElementById("memberIdDocument")?.click()} type="button">
              Upload ID Document
            </Button>
            {fileName && <span className="ml-2 text-sm text-muted-foreground">{fileName}</span>}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="beneficiary"
            checked={currentMember.beneficiary}
            onCheckedChange={(checked) => setCurrentMember({ ...currentMember, beneficiary: checked as boolean })}
          />
          <Label htmlFor="beneficiary">Beneficiary</Label>
        </div>
        <Button type="button" onClick={handleAddMember} disabled={members.length >= 15}>
          Add Member
        </Button>
      </div>
      {members.length > 0 && (
        <div>
          <h4 className="font-semibold mb-2">Added Members:</h4>
          <ul className="space-y-2">
            {members.map((member, index) => (
              <li key={index} className="flex justify-between items-center">
                <span>
                  {member.name} ({member.relation}) - ID: {member.idNumber}
                  {member.beneficiary && " - Beneficiary"}
                </span>
                <Button variant="destructive" size="sm" onClick={() => handleRemoveMember(index)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

