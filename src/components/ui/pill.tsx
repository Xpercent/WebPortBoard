import * as React from "react"
import { cn } from "@/lib/utils"

export function Pill({
  className,
  tone = "muted",
  title,
  children,
}: {
  className?: string
  tone?: "muted" | "primary" | "success" | "danger"
  title?: string
  children: React.ReactNode
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide whitespace-nowrap",
        tone === "muted" && "border-border bg-surface-muted text-muted-foreground",
        tone === "primary" && "border-primary/25 bg-primary/10 text-primary",
        tone === "success" &&
          "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        tone === "danger" && "border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-400",
        className,
      )}
    >
      {children}
    </span>
  )
}
