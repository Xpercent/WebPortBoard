import { ACCENTS, type AccentKey } from "@/types"
import { cn } from "@/lib/utils"

export function AppAvatar({
  name,
  accent,
  size = "md",
  className,
}: {
  name: string
  accent: AccentKey
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  const { from, to } = ACCENTS[accent]
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[14px] font-semibold text-white shadow-md",
        size === "sm" && "size-7 rounded-[9px] text-[13px]",
        size === "md" && "size-11 text-[17px]",
        size === "lg" && "size-16 rounded-2xl text-[26px]",
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(140deg, ${from}, ${to})`,
        boxShadow: size === "sm" ? "none" : `0 8px 20px -8px ${from}b0`,
      }}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </div>
  )
}
