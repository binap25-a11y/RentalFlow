"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

/**
 * 📅 Professional Portfolio Calendar Component
 * Re-engineered for high-fidelity interaction and high-contrast hover states.
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
      className={cn("p-6 bg-white rounded-[2.5rem] shadow-sm ring-1 ring-primary/5", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-6",
        month_caption: "flex justify-center pt-1 relative items-center mb-6 h-10",
        caption_label: "text-lg font-bold font-headline text-primary tracking-tight",
        nav: "space-x-1 flex items-center",
        button_previous: cn(
          "h-9 w-9 bg-transparent p-0 opacity-40 hover:opacity-100 absolute left-1 z-10 rounded-xl border border-primary/10 shadow-sm transition-all flex items-center justify-center cursor-pointer hover:bg-primary/5 hover:text-primary hover:border-primary/20"
        ),
        button_next: cn(
          "h-9 w-9 bg-transparent p-0 opacity-40 hover:opacity-100 absolute right-1 z-10 rounded-xl border border-primary/10 shadow-sm transition-all flex items-center justify-center cursor-pointer hover:bg-primary/5 hover:text-primary hover:border-primary/20"
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex w-full mb-4 justify-between",
        weekday: "text-muted-foreground w-10 font-bold text-[9px] flex items-center justify-center uppercase tracking-[0.3em] h-10 shrink-0 font-headline opacity-30",
        week: "flex w-full mt-2 justify-between",
        day: "h-11 w-11 text-center text-sm p-0 relative focus-within:relative focus-within:z-20 shrink-0 flex items-center justify-center",
        day_button: cn(
          "h-10 w-10 p-0 font-bold aria-selected:opacity-100 rounded-xl transition-all flex flex-col items-center justify-center font-body hover:bg-primary/5 hover:text-primary relative cursor-pointer border-none bg-transparent text-foreground"
        ),
        selected:
          "bg-primary text-white hover:bg-primary hover:text-white focus:bg-primary focus:text-white shadow-xl scale-105 rounded-xl",
        today: "bg-accent/10 text-accent font-extrabold ring-1 ring-accent/20",
        outside:
          "day-outside text-muted-foreground opacity-5 aria-selected:bg-primary/20 aria-selected:text-muted-foreground",
        disabled: "text-muted-foreground opacity-20",
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
