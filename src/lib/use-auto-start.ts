import { useCallback, useEffect, useState } from "react"

const RUNNER_ENDPOINT = "/__auto-start"
const POLL_MS = 2000

export type RunState = "starting" | "running" | "exited"

export type RunAction = "start" | "stop"

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
 * 进程由 dev server 那侧的 auto-start 维护，看板负责取状态、并把启动/中止的请求递过去；
 * 静态部署没有这个接口，取到非 JSON 响应就停止轮询。
 */
export function useAutoStart() {
  const [statuses, setStatuses] = useState<Record<string, RunStatus>>({})
  /** 正在等 Node 侧处理的那个应用，按钮据此显示进行中也挡住重复点击 */
  const [pending, setPending] = useState<string | null>(null)

  /** 返回 false 表示当前环境根本没有这个接口，不用再轮下去 */
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(RUNNER_ENDPOINT)
      if (!(res.headers.get("content-type") ?? "").includes("json")) return false
      const data = (await res.json()) as { apps?: RunStatus[] }

      const next: Record<string, RunStatus> = {}
      for (const item of data.apps ?? []) next[item.id] = item
      setStatuses(next)
    } catch {
      /* dev server 正在重启，下一轮再问 */
    }
    return true
  }, [])

  useEffect(() => {
    let timer = 0
    let stopped = false

    async function poll() {
      const keepGoing = await refresh()
      if (!stopped && keepGoing) timer = window.setTimeout(poll, POLL_MS)
    }

    void poll()

    return () => {
      stopped = true
      window.clearTimeout(timer)
    }
  }, [refresh])

  async function run(id: string, action: RunAction) {
    if (pending) return
    setPending(id)
    try {
      await fetch(RUNNER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      })
    } catch {
      /* 静态部署或 dev server 正在重启 */
    } finally {
      setPending(null)
      // 等处理结果落地再刷一次，不然按钮要等下一轮轮询才换状态
      await refresh()
    }
  }

  return { statuses, pending, run }
}
