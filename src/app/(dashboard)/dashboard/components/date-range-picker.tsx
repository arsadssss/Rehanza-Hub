
"use client"

import * as React from "react"
import { addDays, format } from "date-fns"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function DateRangePicker({
  className,
}: React.HTMLAttributes<HTMLDivElement>) {
  const [date, setDate] = React.useState({
    from: format(new Date(2024, 0, 20), "yyyy-MM-dd"),
    to: format(addDays(new Date(2024, 0, 20), 20), "yyyy-MM-dd"),
  })

  return (
    <div className={cn("grid grid-cols-2 items-center gap-4 w-[300px]", className)}>
      <div className="space-y-1">
        <Label htmlFor="date-from" className="text-xs">From</Label>
        <Input
          id="date-from"
          type="date"
          value={date.from}
          onChange={(e) => setDate((d) => ({ ...d, from: e.target.value }))}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="date-to" className="text-xs">To</Label>
        <Input
          id="date-to"
          type="date"
          value={date.to}
          onChange={(e) => setDate((d) => ({ ...d, to: e.target.value }))}
        />
      </div>
    </div>
  )
}
