import { useEffect, useState, type CSSProperties } from "react"
import { Check, ImageUp, Terminal, X, Zap } from "lucide-react"
import { fileToPreviewDataUrl } from "@/lib/preview-image"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Field, Input, Switch, Textarea } from "@/components/ui/field"
import { ACCENTS, ACCENT_KEYS, PREVIEW_MODES, type AccentKey, type DraftApp } from "@/types"
import { cn } from "@/lib/utils"

const EMPTY: DraftApp = {
  name: "",
  command: "",
  url: "",
  description: "",
  autoStart: false,
  accent: "indigo",
  preview: "none",
  previewImage: "",
}

export function AppFormDialog({
  open,
  title,
  initial,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  title: string
  initial: DraftApp | null
  onOpenChange: (open: boolean) => void
  onSubmit: (draft: DraftApp) => void
}) {
  const [draft, setDraft] = useState<DraftApp>(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (open) {
      setDraft(initial ?? EMPTY)
      setError(null)
    }
  }, [open, initial])

  function set<K extends keyof DraftApp>(key: K, value: DraftApp[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit() {
    if (!draft.name.trim()) return setError("请填写应用名称")
    if (!draft.command.trim()) return setError("请填写启动命令")
    onSubmit({
      ...draft,
      name: draft.name.trim(),
      command: draft.command.trim(),
      url: draft.url.trim(),
      description: draft.description.trim(),
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-[17px] font-semibold tracking-tight">
            {title}
          </DialogTitle>
          <p className="text-[13px] text-muted-foreground">
            配置一个本地项目，它会以卡片的形式出现在看板上。
          </p>
        </DialogHeader>

        <div className="flex flex-col gap-5 px-6 py-5">
          <Field label="应用名称">
            <Input
              autoFocus
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Console Web"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </Field>

          <Field label="启动命令" hint="支持多行 · Ctrl/⌘ + Enter 提交">
            <div className="relative">
              <Terminal className="pointer-events-none absolute left-3.5 top-3.5 size-4 text-muted-foreground" />
              <Textarea
                value={draft.command}
                onChange={(e) => set("command", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault()
                    handleSubmit()
                  }
                }}
                placeholder={"cd /d E:\\path\\to\\project\nnpm run dev"}
                rows={3}
                className="min-h-[84px] pl-10 font-mono text-[13px] leading-relaxed"
                spellCheck={false}
              />
            </div>
          </Field>

          <Field label="访问地址" hint="可选">
            <Input
              value={draft.url}
              onChange={(e) => set("url", e.target.value)}
              placeholder="http://localhost:5173"
            />
          </Field>

          <Field label="备注说明" hint="可选">
            <Textarea
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="这个应用是做什么的，有什么依赖。"
            />
          </Field>

          <Field label="标识色">
            <div className="flex items-center gap-2.5">
              {ACCENT_KEYS.map((key: AccentKey) => {
                const { from, to, label } = ACCENTS[key]
                const active = draft.accent === key
                return (
                  <button
                    key={key}
                    type="button"
                    title={label}
                    onClick={() => set("accent", key)}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "scale-110 ring-2 ring-offset-2 ring-offset-card"
                        : "opacity-65 hover:opacity-100",
                    )}
                    style={
                      {
                        backgroundImage: `linear-gradient(140deg, ${from}, ${to})`,
                        "--tw-ring-color": from,
                      } as CSSProperties
                    }
                  >
                    {active ? (
                      <Check className="size-4 text-white" strokeWidth={3} />
                    ) : null}
                  </button>
                )
              })}
            </div>
          </Field>

          <Field
            label="卡片预览"
            hint={PREVIEW_MODES.find((mode) => mode.value === draft.preview)?.hint}
          >
            <div className="inline-flex rounded-md border border-border bg-surface-muted p-1">
              {PREVIEW_MODES.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => set("preview", mode.value)}
                  className={cn(
                    "rounded-[7px] px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                    draft.preview === mode.value
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </Field>

          {draft.preview === "image" ? (
            <div className="flex flex-col gap-2.5">
              <div className="flex gap-2">
                <Input
                  value={draft.previewImage.startsWith("data:") ? "" : draft.previewImage}
                  onChange={(e) => set("previewImage", e.target.value)}
                  placeholder={draft.previewImage ? "已使用本地图片" : "图片地址，或用右侧上传"}
                  className="flex-1"
                />
                <label className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-md border border-border bg-surface-muted px-3.5 text-[13px] font-medium text-secondary-foreground transition-colors hover:bg-accent">
                  <ImageUp className="size-4" />
                  {uploading ? "处理中" : "上传"}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ""
                      if (!file) return
                      setUploading(true)
                      try {
                        set("previewImage", await fileToPreviewDataUrl(file))
                      } finally {
                        setUploading(false)
                      }
                    }}
                  />
                </label>
              </div>

              {draft.previewImage ? (
                <div className="relative overflow-hidden rounded-md border border-border bg-surface-muted">
                  <img
                    src={draft.previewImage}
                    alt="预览图效果"
                    className="aspect-[16/10] w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => set("previewImage", "")}
                    aria-label="清除预览图"
                    className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {draft.preview === "live" && !draft.url.trim() ? (
            <p className="text-[12px] text-destructive">实时预览需要先填写访问地址。</p>
          ) : null}

          <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-surface-muted/60 px-4 py-3.5">
            <div className="flex items-center gap-3">
              <Zap className="size-4 text-primary" />
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] font-medium">随面板自动启动</span>
                <span className="text-[11.5px] text-muted-foreground">
                  打开看板时记住该应用需要启动
                </span>
              </div>
            </div>
            <Switch
              checked={draft.autoStart}
              onCheckedChange={(v) => set("autoStart", v)}
              aria-label="随面板自动启动"
            />
          </div>

          {error ? <p className="text-[12.5px] text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit}>{initial ? "保存修改" : "添加到看板"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
