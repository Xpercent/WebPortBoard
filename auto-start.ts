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
  /** 配置里的「随面板自动启动」，被界面上的按钮操作过就不再听它 */
  autoStart: boolean
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
  /** 以 config.json 为准：该跑又没跑的补上，不该跑的收掉，命令改了重开 */
  reconcile(): Promise<void>
  statuses(): AppStatus[]
  /** 界面上的启动/中止按钮：记下这个应用的意图并立刻按它调整，返回 false 表示配置里没有它 */
  setIntent(id: string, want: boolean): Promise<boolean>
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
    if (!raw || typeof raw.id !== "string") continue
    if (typeof raw.command !== "string" || !raw.command.trim()) continue
    specs.push({
      id: raw.id,
      name: typeof raw.name === "string" ? raw.name : raw.id,
      command: raw.command,
      url: typeof raw.url === "string" ? raw.url : "",
      autoStart: raw.autoStart === true,
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
  /** 界面按钮按下的意图，优先级高于配置里的 autoStart；重启面板即清空 */
  const intents = new Map<string, boolean>()
  let probeTimer: ReturnType<typeof setTimeout> | undefined
  /** reconcile 串行跑：连着保存两次不能并发拉起同一个应用 */
  let queue: Promise<void> = Promise.resolve()

  function shouldRun(spec: Spec) {
    return intents.get(spec.id) ?? spec.autoStart
  }

  function findSpec(id: string) {
    return readSpecs(configPath)?.find((spec) => spec.id === id)
  }

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
      if (!spec || !shouldRun(spec)) {
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
      if (!kept.has(spec.id) && shouldRun(spec)) await launch(spec)
    }
    syncProbing()
  }

  async function applyIntent(id: string, want: boolean) {
    const spec = findSpec(id)
    if (!spec) {
      intents.delete(id)
      return false
    }
    intents.set(id, want)

    const run = queue.then(async () => {
      const task = tasks.get(id)
      if (want && (!task || task.state === "exited")) {
        // 自己退出的任务还占在表里，摘掉它才能按当前命令重开
        if (task) drop(task)
        await launch(spec)
      } else if (!want && task) {
        await stop(task)
      }
      syncProbing()
    })
    queue = run.catch(() => {})
    await run
    return true
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
    setIntent: applyIntent,
    shutdown() {
      for (const task of tasks.values()) killTree(task)
      tasks.clear()
      syncProbing()
    },
  }
}

/** 界面上的按钮只发一个 id，正文超过这个长度就不是给这里用的 */
const MAX_BODY = 4096

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on("data", (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(new Error("body too large"))
        return
      }
      chunks.push(chunk)
    })
    req.on("error", reject)
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")))
      } catch {
        reject(new Error("invalid json"))
      }
    })
  })
}

function json(res: ServerResponse, code: number, body: Record<string, unknown>) {
  res.statusCode = code
  res.setHeader("Content-Type", "application/json")
  res.end(JSON.stringify(body))
}

async function control(req: IncomingMessage, res: ServerResponse, runner: AppRunner) {
  let raw: unknown
  try {
    raw = await readBody(req)
  } catch {
    json(res, 400, { error: "invalid json" })
    return
  }

  const { id, action } = (raw ?? {}) as { id?: unknown; action?: unknown }
  const want = action === "start" ? true : action === "stop" ? false : null
  if (typeof id !== "string" || !id || want === null) {
    json(res, 400, { error: "need id and action=start|stop" })
    return
  }

  const ok = await runner.setIntent(id, want)
  json(res, ok ? 200 : 404, ok ? { ok: true } : { error: "unknown app" })
}

export function autoStart(runner: AppRunner): Plugin {
  return {
    name: "app-auto-start",
    configureServer(server) {
      server.middlewares.use(ENDPOINT, (req: IncomingMessage, res: ServerResponse) => {
        if (req.method === "GET") {
          json(res, 200, { apps: runner.statuses() })
          return
        }
        if (req.method === "POST") {
          void control(req, res, runner)
          return
        }
        json(res, 405, { error: "method not allowed" })
      })

      const http = server.httpServer
      if (!http) return
      if (http.listening) void runner.reconcile()
      else http.once("listening", () => void runner.reconcile())
      http.on("close", () => runner.shutdown())
    },
  }
}
