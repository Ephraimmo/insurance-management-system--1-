"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"

export function DatePicker({ selected, onSelect }: { selected?: Date | null; onSelect: (date: Date | null) => void }) {
  const [date, setDate] = useState<string | null>(selected ? selected.toISOString().slice(0, 10) : null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDate(e.target.value)
  }

  const handleBlur = () => {
    if (date) {
      const parsedDate = new Date(date)
      if (isNaN(parsedDate.getTime())) {
        onSelect(null)
      } else {
        onSelect(parsedDate)
      }
    } else {
      onSelect(null)
    }
  }

  return (
    <div>
      <Input type="date" value={date || ""} onChange={handleChange} onBlur={handleBlur} />
    </div>
  )
}

