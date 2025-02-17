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
            {selected ? format(selected, "dd/MM/yyyy") : "Pick a date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-auto p-0" 
          align="start"
          role="dialog"
          aria-label="Choose date"
        >
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(date) => {
              onSelect(date);
              setIsOpen(false);
            }}
            initialFocus
            className="rdp"
            fromDate={new Date(1900, 0, 1)}
            toDate={new Date(2100, 11, 31)}
            formatters={{
              formatDay: (date) => {
                const formattedDate = format(date, "yyyy-MM-dd");
                return (
                  <div data-date={formattedDate}>
                    {date.getDate()}
                  </div>
                );
              }
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

