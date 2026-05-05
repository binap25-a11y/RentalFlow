"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      // Enable dropdown navigation for easier year/month selection (e.g. for long-term EPCs)
      captionLayout="dropdown"
      // Range: 10 years past to 20 years future
      startMonth={new Date(new Date().getFullYear() - 10, 0)}
      endMonth={new Date(new Date().getFullYear() + 20, 11)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        month_caption: "flex justify-center pt-1 relative items-center mb-2",
        caption_label: "text-sm font-semibold font-headline text-primary",
        nav: "space-x-1 flex items-center",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute left-1 z-10 rounded-lg border-primary/20"
        ),
        button_previous_icon: "h-4 w-4",
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute right-1 z-10 rounded-lg border-primary/20"
        ),
        button_next_icon: "h-4 w-4",
        month_grid: "w-full border-collapse",
        weekdays: "flex w-full mb-2 justify-between",
        weekday: "text-muted-foreground w-9 font-bold text-[0.7rem] flex items-center justify-center uppercase tracking-tighter h-9 shrink-0 font-headline",
        week: "flex w-full mt-1 justify-between",
        day: "h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20 shrink-0 flex items-center justify-center",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-medium aria-selected:opacity-100 rounded-lg transition-all flex items-center justify-center font-body"
        ),
        range_start: "day-range-start",
        range_end: "day-range-end",
        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground shadow-md",
        today: "bg-accent/10 text-accent font-bold",
        outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
        disabled: "text-muted-foreground opacity-50",
        range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        hidden: "invisible",
        // Enhanced Dropdown Styles for RDP v9
        dropdown: "relative inline-flex items-center",
        dropdown_root: "flex items-center gap-1",
        caption_dropdowns: "flex justify-center gap-2 mb-4",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ...props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ...props }) => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }