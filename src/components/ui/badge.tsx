import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        negotiating: "border-transparent bg-status-negotiating text-status-negotiating-foreground",
        pending: "border-transparent bg-status-pending text-status-pending-foreground",
        approved: "border-transparent bg-status-approved text-status-approved-foreground",
        rejected: "border-transparent bg-status-rejected text-status-rejected-foreground",
        completed: "border-transparent bg-status-completed text-status-completed-foreground",
        "severity-low": "border-transparent bg-severity-low text-severity-low-foreground",
        "severity-medium": "border-transparent bg-severity-medium text-severity-medium-foreground",
        "severity-high": "border-transparent bg-severity-high text-severity-high-foreground",
        "severity-critical": "border-transparent bg-severity-critical text-severity-critical-foreground",
        "verdict-clean": "border-transparent bg-verdict-clean text-verdict-clean-foreground",
        "verdict-suspicious": "border-transparent bg-verdict-suspicious text-verdict-suspicious-foreground",
        "verdict-malicious": "border-transparent bg-verdict-malicious text-verdict-malicious-foreground",
        "verdict-unknown": "border-transparent bg-verdict-unknown text-verdict-unknown-foreground",
        "incident-detected": "border-transparent bg-incident-status-detected text-incident-status-detected-foreground",
        "incident-analyzing": "border-transparent bg-incident-status-analyzing text-incident-status-analyzing-foreground",
        "incident-pending": "border-transparent bg-incident-status-pending text-incident-status-pending-foreground",
        "incident-resolved": "border-transparent bg-incident-status-resolved text-incident-status-resolved-foreground",
        "incident-dismissed": "border-transparent bg-incident-status-dismissed text-incident-status-dismissed-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export { Badge, badgeVariants }
