import { spawn, type ChildProcess } from "node:child_process"
import { readFileSync } from "node:fs"
import type { IncomingMessage, Plugin, ServerResponse } from "vite"

const ENDPOINT = "/__auto-start"
const PROBE_EVERY = 1500
const PROBE_TIMEOUT = 2000
/** 命令变更后等旧进程退出的上限，超时就不再等，直接按新命令拉起 */
const KILL_WAIT = 5000
/** 只把末尾这些行交给界面，够看清失败原因，又不会把响应撑爆 */
const LOG_TAIL = 12

export type AppRunState = "starting" | "running" | "exited"

export interface AppStatus {
  id: string
  name: string
  state: AppRunState
  /** 看板拉起前这个地址就已经可访问，进程不归看板管 */
  external: boolean
  exitCode: number | null
  log: string[]
}

interface Spec {
  id: string
  name: string
  command: string
  url: string
}

interface Task extends Spec {
  child?: ChildProcess
  state: AppRunState
  external: boolean
  exitCode: number | null
  log: string[]
  /** stdout/stderr 里最后一段没换行的残行 */
  rest: string
  stopping: boolean
}

export interface AppRunner {
  /** 以 config.json 里的 autoStart 为准：缺的补上，多了收掉，命令改了重开 */
  reconcile(): Promise<void>
  statuses(): AppStatus[]
  shutdown(): void
}

/** 读不到或解析失败都返回 null：这种情况要维持现状，不能把在跑的进程全收掉 */
function readSpecs(configPath: string): Spec[] | null {
  let data: unknown
  try {
    data = JSON.parse(readFileSync(configPath, "utf8"))
  } catch {
    return null
  }

  const list = (data as { apps?: unknown })?.apps
  if (!Array.isArray(list)) return null

  const specs: Spec[] = []
  for (const item of list) {
    const raw = item as (Partial<Spec> & { autoStart?: unknown }) | null
    if (!raw || raw.autoStart !== true || typeof raw.id !== "string") continue
    if (typeof raw.command !== "string" || !raw.command.trim()) continue
    specs.push({
      id: raw.id,
      name: typeof raw.name === "string" ? raw.name : raw.id,
      command: raw.command,
      url: typeof raw.url === "string" ? raw.url : "",
    })
  }
  return specs
}

/** shell:true 时 cmd 只执行换行前的第一行，所以多行命令按顺序串成一条：前一步失败就不会带着错误的目录继续跑 */
function toShellCommand(command: string) {
  return command
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .join(" && ")
}

/** 拿到任何响应都算服务起来了，404 也说明端口上确实有东西在听 */
async function reachable(url: string) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(PROBE_TIMEOUT) })
    return true
  } catch {
    return false
  }
}

function decode(chunk: Buffer) {
  if (process.platform !== "win32") return chunk.toString("utf8")
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(chunk)
  } catch {
    return new TextDecoder("gbk").decode(chunk)
  }
}

/** 日志要给界面当提示用，dev server 打出的 ANSI 颜色码得去掉 */
function stripAnsi(line: string) {
  return line.replace(/\u001b\[[0-9;]*[A-Za-z]/g, "")
}

export function createAppRunner(configPath: string): AppRunner {
  const tasks = new Map<string, Task>()
  let probeTimer: ReturnType<typeof setTimeout> | undefined
  /** reconcile 串行跑：连着保存两次不能并发拉起同一个应用 */
  let queue: Promise<void> = Promise.resolve()

  function hasStarting() {
    return [...tasks.values()].some((task) => task.state === "starting")
  }

  function syncProbing() {
    if (hasStarting()) {
      if (!probeTimer) probeTimer = setTimeout(probeRound, PROBE_EVERY)
    } else if (probeTimer) {
      clearTimeout(probeTimer)
      probeTimer = undefined
    }
  }

  function probeRound() {
    probeTimer = undefined
    for (const task of tasks.values()) {
      if (task.state !== "starting" || !task.url) continue
      void reachable(task.url).then((ok) => {
        if (ok && task.state === "starting") task.state = "running"
      })
    }
    syncProbing()
  }

  function appendLog(task: Task, chunk: Buffer) {
    const lines = (task.rest + decode(chunk)).split(/\r?\n/)
    task.rest = lines.pop() ?? ""
    for (const raw of lines) {
      const line = stripAnsi(raw)
      if (!line.trim()) continue
      task.log.push(line)
      if (task.log.length > LOG_TAIL) task.log.shift()
    }
  }

  function killTree(task: Task) {
    const pid = task.child?.pid
    task.stopping = true
    if (!pid) return

    if (process.platform === "win32") {
      // npm、node 都挂在这条 cmd 下面，只杀 cmd 会留下占着端口的孤儿
      spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" })
      return
    }

    try {
      process.kill(-pid, "SIGTERM")
      setTimeout(() => {
        try {
          process.kill(-pid, "SIGKILL")
        } catch {
          /* 已经退出了 */
        }
      }, 2000).unref()
    } catch {
      task.child?.kill("SIGKILL")
    }
  }

  function drop(task: Task) {
    if (tasks.get(task.id) === task) tasks.delete(task.id)
  }

  function stop(task: Task): Promise<void> {
    const child = task.child
    if (!child?.pid) {
      drop(task)
      return Promise.resolve()
    }

    killTree(task)
    return new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer)
        resolve()
      }
      const timer = setTimeout(done, KILL_WAIT)
      timer.unref()
      child.once("exit", done)
    }).then(() => drop(task))
  }

  function finish(task: Task, code: number | null) {
    task.child = undefined
    if (task.stopping) {
      drop(task)
      return
    }
    task.state = "exited"
    task.exitCode = code
    syncProbing()
  }

  function spawnTask(task: Task) {
    const child = spawn(toShellCommand(task.command), {
      shell: true,
      windowsHide: true,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    })
    task.child = child

    child.stdout?.on("data", (chunk: Buffer) => appendLog(task, chunk))
    child.stderr?.on("data", (chunk: Buffer) => appendLog(task, chunk))
    child.on("error", (err: Error) => {
      task.log.push(String(err.message))
      finish(task, null)
    })
    child.on("exit", (code) => finish(task, code))
    child.on("spawn", () => {
      // 没填访问地址就无从探测，进程起来就算在跑
      if (!task.url) task.state = "running"
      syncProbing()
    })
  }

  async function launch(spec: Spec) {
    const task: Task = {
      ...spec,
      state: "starting",
      external: false,
      exitCode: null,
      log: [],
      rest: "",
      stopping: false,
    }
    tasks.set(spec.id, task)

    if (spec.url && (await reachable(spec.url))) {
      task.state = "running"
      task.external = true
      return
    }
    // 探测这段时间里可能已经被下一轮 reconcile 换掉，不能再把进程挂到旧任务上
    if (tasks.get(spec.id) !== task) return
    spawnTask(task)
  }

  async function reconcileNow() {
    const specs = readSpecs(configPath)
    if (!specs) return
    const desired = new Map(specs.map((spec) => [spec.id, spec]))
    const kept = new Set<string>()

    for (const task of [...tasks.values()]) {
      const spec = desired.get(task.id)
      if (!spec) {
        await stop(task)
        continue
      }
      task.name = spec.name
      task.url = spec.url
      if (spec.command === task.command) {
        kept.add(task.id)
        continue
      }
      // 改了命令才重开；自己退出的应用保持现状，避免每次保存都重试一遍坏命令
      await stop(task)
    }

    for (const spec of desired.values()) {
      if (!kept.has(spec.id)) await launch(spec)
    }
    syncProbing()
  }

  return {
    reconcile() {
      const run = queue.then(reconcileNow)
      queue = run.catch(() => {})
      return run
    },
    statuses: () =>
      [...tasks.values()].map((task) => ({
        id: task.id,
        name: task.name,
        state: task.state,
        external: task.external,
        exitCode: task.exitCode,
        log: [...task.log],
      })),
    shutdown() {
      for (const task of tasks.values()) killTree(task)
      tasks.clear()
      syncProbing()
    },
  }
}

export function autoStart(runner: AppRunner): Plugin {
  return {
    name: "app-auto-start",
    configureServer(server) {
      server.middlewares.use(ENDPOINT, (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== "GET") {
          res.statusCode = 405
          res.end('{"error":"method not allowed"}')
          return
        }
        res.setHeader("Content-Type", "application/json")
        res.end(JSON.stringify({ apps: runner.statuses() }))
      })

      const http = server.httpServer
      if (!http) return
      if (http.listening) void runner.reconcile()
      else http.once("listening", () => void runner.reconcile())
      http.on("close", () => runner.shutdown())
    },
  }
}
