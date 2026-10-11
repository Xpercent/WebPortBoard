import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import * as SwitchPrimitive from "@radix-ui/react-switch"
import { cn } from "@/lib/utils"

export function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn(
        "text-[13px] font-medium leading-none text-foreground peer-disabled:opacity-60",
        className,
      )}
      {...props}
    />
  )
}

const fieldBase =
  "w-full rounded-md border border-input bg-surface px-3.5 text-sm text-foreground shadow-none outline-none transition-colors placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/25 disabled:opacity-60"

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(fieldBase, "h-10", className)} {...props} />
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(fieldBase, "min-h-[72px] resize-none py-2.5 leading-relaxed", className)}
      {...props}
    />
  )
}

export function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card data-[state=checked]:bg-primary data-[state=unchecked]:bg-surface-muted data-[state=unchecked]:border-input",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block size-5 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform data-[state=checked]:translate-x-[22px] data-[state=unchecked]:translate-x-0.5",
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string
  hint?: string
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-4">
        <Label htmlFor={htmlFor}>{label}</Label>
        {hint ? (
          <span className="text-[11px] text-muted-foreground/80">{hint}</span>
        ) : null}
      </div>
      {children}
    </div>
  )
}
