import { useEffect, useState } from "react"
import { Check, Copy } from "lucide-react"
import { AppAvatar } from "@/components/app-avatar"
import { Button } from "@/components/ui/button"
import type { AppEntry } from "@/types"

export function AppRunner({ app }: { app: AppEntry }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(timer)
  }, [copied])

  async function copyCommand() {
    await navigator.clipboard.writeText(app.command)
    setCopied(true)
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-muted">
      {app.url ? (
        <iframe
          key={app.url}
          src={app.url}
          title={app.name}
          className="size-full border-0 bg-white"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals"
        />
      ) : (
        <div className="flex h-full items-center justify-center p-8">
          <div className="flex max-w-md min-w-0 flex-col items-center gap-4 rounded-lg border border-dashed border-border bg-card p-8 text-center shadow-panel">
            <AppAvatar name={app.name} accent={app.accent} size="lg" />
            <div className="flex flex-col gap-1.5">
              <h2 className="text-[16px] font-semibold tracking-tight">未配置访问地址</h2>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                {app.description || "给这个应用填上访问地址后，页面就会直接显示在这里。"}
              </p>
            </div>
            <pre className="w-full overflow-x-auto rounded-md border border-border bg-surface-muted/60 p-3.5 text-left font-mono text-[12px] leading-relaxed text-foreground [overflow-wrap:anywhere] whitespace-pre-wrap">
              {app.command}
            </pre>
            <Button variant="outline" size="sm" onClick={copyCommand}>
              {copied ? <Check /> : <Copy />}
              {copied ? "已复制启动命令" : "复制启动命令"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
