"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

/**
 * 📅 Professional Portfolio Calendar
 * Re-engineered for React Day Picker v9 compatibility.
 * Optimized with a premium navy visual identity.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-4 bg-white rounded-3xl shadow-sm", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        month_caption: "flex justify-center pt-1 relative items-center mb-6 h-9",
        caption_label: "text-base font-bold font-headline text-primary tracking-tight",
        nav: "space-x-1 flex items-center",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-8 w-8 bg-transparent p-0 opacity-50 hover:opacity-100 absolute left-1 z-10 rounded-xl border-primary/10 shadow-sm"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-8 w-8 bg-transparent p-0 opacity-50 hover:opacity-100 absolute right-1 z-10 rounded-xl border-primary/10 shadow-sm"
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex w-full mb-4 justify-between",
        weekday: "text-muted-foreground w-9 font-bold text-[10px] flex items-center justify-center uppercase tracking-[0.2em] h-9 shrink-0 font-headline opacity-40",
        week: "flex w-full mt-1 justify-between",
        day: "h-10 w-10 text-center text-sm p-0 relative focus-within:relative focus-within:z-20 shrink-0 flex items-center justify-center",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-10 w-10 p-0 font-bold aria-selected:opacity-100 rounded-xl transition-all flex flex-col items-center justify-center font-body hover:bg-primary/5 hover:text-primary relative"
        ),
        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground shadow-xl scale-110",
        today: "bg-accent/10 text-accent font-bold ring-1 ring-accent/20",
        outside:
          "day-outside text-muted-foreground opacity-30 aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
        disabled: "text-muted-foreground opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          if (orientation === 'left') {
            return <ChevronLeft className="h-4 w-4" />
          }
          return <ChevronRight className="h-4 w-4" />
        }
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
