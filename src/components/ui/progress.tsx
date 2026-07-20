import * as React from "react"
import { cn } from "@/lib/utils"

export interface ProgressProps
  extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  className?: string
}

const Progress = React.forwardRef<
  HTMLDivElement,
  ProgressProps
>(({ className, value, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative h-2 w-full overflow-hidden rounded-full bg-secondary",
      className
    )}
    {...props}
  >
    <div
      className="h-full w-full transition-all transform translate-x-0 bg-primary text-xs text-primary-foreground font-medium"
      style={{
        transform: `scaleX(${value / 100})`,
        transformOrigin: "left",
      }}
    />
  </div>
))
Progress.displayName = "Progress"

export { Progress }