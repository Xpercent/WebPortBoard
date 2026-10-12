import { useEffect, useState } from "react"

const RUNNER_ENDPOINT = "/__auto-start"
const POLL_MS = 2000

export type RunState = "starting" | "running" | "exited"

export interface RunStatus {
  id: string
  name: string
  state: RunState
  /** 看板拉起前地址就已经可访问，进程不归看板管 */
  external: boolean
  exitCode: number | null
  log: string[]
}

/**
 * 进程由 dev server 那侧的 auto-start 维护，看板只负责把状态取回来；
 * 静态部署没有这个接口，取到非 JSON 响应就停止轮询。
 */
export function useAutoStart() {
  const [statuses, setStatuses] = useState<Record<string, RunStatus>>({})

  useEffect(() => {
    let timer = 0
    let stopped = false

    async function poll() {
      try {
        const res = await fetch(RUNNER_ENDPOINT)
        if (!(res.headers.get("content-type") ?? "").includes("json")) return
        const data = (await res.json()) as { apps?: RunStatus[] }
        if (stopped) return

        const next: Record<string, RunStatus> = {}
        for (const item of data.apps ?? []) next[item.id] = item
        setStatuses(next)
      } catch {
        /* dev server 正在重启，下一轮再问 */
      }
      timer = window.setTimeout(poll, POLL_MS)
    }

    void poll()

    return () => {
      stopped = true
      window.clearTimeout(timer)
    }
  }, [])

  return statuses
}
