import { useEffect, useRef, useState } from "react"
import {
  ArrowLeft,
  ExternalLink,
  LayoutGrid,
  Moon,
  Pencil,
  Plus,
  RefreshCw,
  Sun,
  Trash2,
} from "lucide-react"
import { AppAvatar } from "@/components/app-avatar"
import { AppCard } from "@/components/app-card"
import { AppLivePreview } from "@/components/app-live-preview"
import { AppRunner } from "@/components/app-runner"
import { AppFormDialog } from "@/components/app-form-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toDraft, useApps } from "@/lib/use-apps"
import { useAutoStart } from "@/lib/use-auto-start"
import { useTheme } from "@/lib/use-theme"
import { cn } from "@/lib/utils"
import type { AppEntry, DraftApp } from "@/types"

export default function App() {
  const { apps, addApp, updateApp, removeApp, store } = useApps()
  const statuses = useAutoStart()
  const { theme, toggleTheme } = useTheme()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AppEntry | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<AppEntry | null>(null)
  /** 打开过的应用保持挂载，返回看板不会卸载页面 */
  const [liveIds, setLiveIds] = useState<string[]>([])
  /** 每个应用的重载计数，变化时重建对应的内嵌页面 */
  const [reloadTicks, setReloadTicks] = useState<Record<string, number>>({})

  const mainRef = useRef<HTMLElement>(null)
  /** 上一轮的进程状态，用来认出「这一轮刚刚就绪」 */
  const statesRef = useRef<Record<string, string>>({})

  const selectedApp = apps.find((app) => app.id === selectedId) ?? null
  /** 实时预览应用由预览层的同一个 iframe 兼顾卡片缩略与全屏，不再另挂 Runner */
  const stageApps = apps.filter((app) => app.preview === "live" && !!app.url)
  const stageIds = new Set(stageApps.map((app) => app.id))
  const runnerApps = apps.filter((app) => liveIds.includes(app.id) && !stageIds.has(app.id))
  const autoCount = apps.filter((app) => app.autoStart).length
  const runningCount = Object.values(statuses).filter((s) => s.state === "running").length

  useEffect(() => {
    const prev = statesRef.current
    statesRef.current = Object.fromEntries(
      Object.entries(statuses).map(([id, status]) => [id, status.state]),
    )

    for (const [id, state] of Object.entries(statesRef.current)) {
      // 自动启动就绪后刷一次已挂载的页面，不然它会停在「找不到 localhost」的错误页上
      const was = prev[id]
      if (state === "running" && (was === "starting" || was === "exited")) {
        setReloadTicks((ticks) => ({ ...ticks, [id]: (ticks[id] ?? 0) + 1 }))
      }
    }
  }, [statuses])

  function openApp(id: string) {
    setSelectedId(id)
    setLiveIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }

  function reloadApp() {
    if (!selectedId) return
    setReloadTicks((prev) => ({ ...prev, [selectedId]: (prev[selectedId] ?? 0) + 1 }))
  }

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(app: AppEntry) {
    setEditing(app)
    setFormOpen(true)
  }

  function handleSubmit(draft: DraftApp) {
    if (editing) updateApp(editing.id, draft)
    else addApp(draft)
  }

  function confirmDelete() {
    if (!pendingDelete) return
    removeApp(pendingDelete.id)
    setLiveIds((prev) => prev.filter((id) => id !== pendingDelete.id))
    setSelectedId(null)
    setPendingDelete(null)
  }

  return (
    <div className="app-canvas flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-surface/80 px-5 backdrop-blur-xl">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="flex shrink-0 items-center gap-2">
            <span className="size-3 rounded-full bg-[#ff5f57]" />
            <span className="size-3 rounded-full bg-[#febc2e]" />
            <span className="size-3 rounded-full bg-[#28c840]" />
          </div>

          {selectedApp ? (
            <div className="flex min-w-0 items-center gap-2.5 border-l border-border pl-4">
              <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setSelectedId(null)}>
                <ArrowLeft />
                看板
              </Button>
              <AppAvatar name={selectedApp.name} accent={selectedApp.accent} size="sm" />
              <span className="truncate text-[13.5px] font-semibold tracking-tight">
                {selectedApp.name}
              </span>
              {selectedApp.description ? (
                <span className="hidden min-w-0 truncate text-[12.5px] text-muted-foreground xl:inline">
                  {selectedApp.description}
                </span>
              ) : null}
            </div>
          ) : (
            <div className="flex min-w-0 items-center gap-2 border-l border-border pl-4">
              <LayoutGrid className="size-4 shrink-0 text-primary" />
              <span className="shrink-0 text-[13.5px] font-semibold tracking-tight">
                WebPortBoard
              </span>
              <span className="hidden truncate text-[12.5px] text-muted-foreground lg:inline">
                本地项目运行看板 · {store === "file" ? "config.json" : "浏览器缓存"}
              </span>
            </div>
          )}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {selectedApp && (
            <>
              <Button
                variant="ghost"
                size="icon"
                title="重新加载"
                aria-label="重新加载"
                onClick={reloadApp}
                disabled={!selectedApp.url}
              >
                <RefreshCw />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="在新窗口打开"
                aria-label="在新窗口打开"
                disabled={!selectedApp.url}
                onClick={() => window.open(selectedApp.url, "_blank", "noopener")}
              >
                <ExternalLink />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => openEdit(selectedApp)}>
                <Pencil />
                编辑
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => setPendingDelete(selectedApp)}
              >
                <Trash2 />
                移除
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="切换明暗主题"
            title={theme === "dark" ? "切换到浅色" : "切换到深色"}
          >
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>
          {!selectedApp && (
            <Button size="sm" onClick={openCreate}>
              <Plus />
              添加应用
            </Button>
          )}
        </div>
      </header>

      <main ref={mainRef} className="relative min-h-0 flex-1 overflow-hidden">
        <div
          className={cn(
            "scroll-surface absolute inset-0 overflow-y-auto px-8 py-8",
            selectedId ? "invisible" : "visible",
          )}
        >
          <section className="mx-auto w-full max-w-6xl">
            <div className="flex items-end justify-between gap-4 pb-7">
              <div className="flex flex-col gap-1.5">
                <h1 className="text-[26px] leading-none font-semibold tracking-tight">应用看板</h1>
                <p className="text-[13px] text-muted-foreground">
                  共 {apps.length} 个应用 · {autoCount} 个随面板自动启动
                  {runningCount > 0 ? ` · ${runningCount} 个在运行` : ""}
                  {liveIds.length > 0 ? ` · ${liveIds.length} 个已打开` : ""}
                </p>
              </div>
            </div>

            {apps.length === 0 ? (
              <EmptyState onAdd={openCreate} />
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(288px,1fr))] gap-5">
                {apps.map((app) => (
                  <AppCard
                    key={app.id}
                    app={app}
                    opened={liveIds.includes(app.id)}
                    status={statuses[app.id]}
                    onOpen={() => openApp(app.id)}
                  />
                ))}
                <AddTile onAdd={openCreate} />
              </div>
            )}
          </section>
        </div>

        {runnerApps.map((app) => (
          <div
            key={`${app.id}|${app.url}|${app.command}|${reloadTicks[app.id] ?? 0}`}
            className={cn("absolute inset-0", selectedId === app.id ? "visible" : "invisible")}
          >
            <AppRunner app={app} />
          </div>
        ))}

        {stageApps.map((app) => (
          <AppLivePreview
            key={app.id}
            app={app}
            containerRef={mainRef}
            expanded={selectedId === app.id}
            reloadTick={reloadTicks[app.id] ?? 0}
          />
        ))}
      </main>

      <AppFormDialog
        open={formOpen}
        title={editing ? "编辑应用" : "添加应用"}
        initial={editing ? toDraft(editing) : null}
        onOpenChange={setFormOpen}
        onSubmit={handleSubmit}
      />

      <Dialog open={!!pendingDelete} onOpenChange={(v) => !v && setPendingDelete(null)}>
        <DialogContent className="w-[min(420px,calc(100vw-2rem))]">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-semibold">
              移除「{pendingDelete?.name}」？
            </DialogTitle>
            <p className="text-[13px] text-muted-foreground">
              该应用将从看板中删除，配置无法恢复。
            </p>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              <Trash2 />
              确认移除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AddTile({ onAdd }: { onAdd: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="group flex min-h-[188px] flex-col items-center justify-center gap-2.5 rounded-lg border border-dashed border-border bg-transparent text-muted-foreground outline-none transition-all hover:-translate-y-1 hover:border-primary/45 hover:bg-primary/5 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex size-9 items-center justify-center rounded-full border border-border bg-surface">
        <Plus className="size-4" />
      </span>
      <span className="text-[13px] font-medium">添加应用</span>
    </button>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border py-24 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-surface-muted">
        <LayoutGrid className="size-5 text-muted-foreground" />
      </span>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-[15px] font-semibold">看板还是空的</h2>
        <p className="text-[13px] text-muted-foreground">添加第一个本地项目，它就会出现在这里。</p>
      </div>
      <Button onClick={onAdd}>
        <Plus />
        添加应用
      </Button>
    </div>
  )
}
