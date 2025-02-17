"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { DayPicker } from "react-day-picker"

interface DatePickerProps {
  selected?: Date | null
  onSelect: (date: Date | null) => void
  id?: string
  className?: string
}

export function DatePicker({ selected, onSelect, id, className }: DatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  // Handle programmatic updates
  React.useEffect(() => {
    if (selected) {
      setIsOpen(false); // Close the calendar if date is set programmatically
    }
  }, [selected]);

  return (
    <div className={className}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal",
              !selected && "text-muted-foreground"
            )}
            role="combobox"
            aria-expanded={isOpen}
            aria-haspopup="dialog"
            aria-label="Date of Birth"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {selected ? format(selected, "PPP") : "Pick a date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-auto p-0" 
          align="start"
          role="dialog"
          aria-label="Choose date"
        >
          <DayPicker
            mode="single"
            selected={selected || undefined}
            onSelect={(date) => {
              onSelect(date || null)
              setIsOpen(false)
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

