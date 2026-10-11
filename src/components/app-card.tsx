import { ArrowUpRight, Zap } from "lucide-react"
import { AppAvatar } from "@/components/app-avatar"
import { Pill } from "@/components/ui/pill"
import { ACCENTS, type AppEntry } from "@/types"

export function AppCard({
  app,
  running,
  onOpen,
}: {
  app: AppEntry
  running: boolean
  onOpen: () => void
}) {
  const lines = app.command.split(/\r?\n/).filter((line) => line.trim())
  const extraLines = Math.max(lines.length - 1, 0)
  const { from, to } = ACCENTS[app.accent]
  /** 实时预览的 iframe 挂在 main 上覆盖这块区域，卡片这里只留骨架 */
  const live = app.preview === "live" && !!app.url

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card text-left shadow-panel outline-none transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-panel-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div
        data-preview-anchor={live ? app.id : undefined}
        className="relative aspect-[16/10] w-full overflow-hidden border-b border-border bg-surface-muted"
      >
        {app.preview === "image" && app.previewImage ? (
          <img
            src={app.previewImage}
            alt={`${app.name} 预览`}
            className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div
            className="flex size-full items-center justify-center"
            style={{
              backgroundImage: `radial-gradient(130% 130% at 18% 0%, ${from}30, transparent 62%), radial-gradient(120% 120% at 92% 100%, ${to}26, transparent 58%)`,
            }}
          >
            <AppAvatar name={app.name} accent={app.accent} />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2">
          <h3 className="min-w-0 flex-1 truncate text-[14.5px] font-semibold tracking-tight">
            {app.name}
          </h3>
          {running ? (
            <Pill tone="success" className="shrink-0 px-2 py-[3px] text-[10.5px]">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              运行中
            </Pill>
          ) : null}
          {app.autoStart ? (
            <Pill tone="primary">
              <Zap className="size-3" />
              自动
            </Pill>
          ) : null}
        </div>

        <p className="line-clamp-1 text-[12.5px] text-muted-foreground">
          {app.description || "未填写说明"}
        </p>

        <div className="mt-auto flex items-center gap-2 pt-1.5">
          <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
            {lines[0] ?? ""}
          </code>
          {extraLines > 0 ? <Pill>+{extraLines} 行</Pill> : null}
          <ArrowUpRight className="size-4 shrink-0 -translate-x-1 text-primary opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
        </div>
      </div>
    </button>
  )
}
