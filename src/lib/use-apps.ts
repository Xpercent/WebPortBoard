import { useEffect, useRef, useState } from "react"
import { ACCENTS, type AppEntry, type DraftApp } from "@/types"

const CONFIG_ENDPOINT = "/__panel/config"
const CACHE_KEY = "webapp-panel:apps:v1"

function normalize(raw: unknown): AppEntry | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Partial<AppEntry>
  if (typeof r.name !== "string" || typeof r.command !== "string") return null
  return {
    id: typeof r.id === "string" ? r.id : crypto.randomUUID(),
    name: r.name,
    command: r.command,
    url: typeof r.url === "string" ? r.url : "",
    description: typeof r.description === "string" ? r.description : "",
    autoStart: !!r.autoStart,
    accent: r.accent && r.accent in ACCENTS ? r.accent : "indigo",
    preview: r.preview === "image" ? "image" : "none",
    previewImage: typeof r.previewImage === "string" ? r.previewImage : "",
    createdAt: typeof r.createdAt === "number" ? r.createdAt : Date.now(),
  }
}

function parseList(raw: unknown): AppEntry[] {
  const list = Array.isArray(raw) ? raw : (raw as { apps?: unknown })?.apps
  if (!Array.isArray(list)) return []
  return list.map(normalize).filter((app): app is AppEntry => app !== null)
}

/** 文件读取前先用上次的缓存渲染，避免看板闪空 */
function readCache(): AppEntry[] {
  try {
    return parseList(JSON.parse(localStorage.getItem(CACHE_KEY) || "[]"))
  } catch {
    return []
  }
}

export function useApps() {
  const [apps, setApps] = useState<AppEntry[]>(readCache)
  /** file = 由 dev server 读写 panel.config.json；local = 静态部署时退回浏览器本地 */
  const [store, setStore] = useState<"file" | "local">("local")
  const skipNextWrite = useRef(true)

  useEffect(() => {
    let cancelled = false

    fetch(CONFIG_ENDPOINT)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((data: unknown) => {
        if (cancelled) return
        skipNextWrite.current = true
        setApps(parseList(data))
        setStore("file")
      })
      .catch(() => {
        /* 静态部署没有这个接口，继续用浏览器本地缓存 */
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (skipNextWrite.current) {
      skipNextWrite.current = false
      return
    }

    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(apps))
    } catch {
      /* 预览图过大时缓存可能写不进去，文件仍是权威来源 */
    }

    if (store === "file") {
      fetch(CONFIG_ENDPOINT, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apps }, null, 2),
      }).catch(() => setStore("local"))
    }
  }, [apps, store])

  function addApp(draft: DraftApp) {
    setApps((prev) => [
      { ...draft, id: crypto.randomUUID(), createdAt: Date.now() },
      ...prev,
    ])
  }

  function updateApp(id: string, draft: DraftApp) {
    setApps((prev) => prev.map((app) => (app.id === id ? { ...app, ...draft } : app)))
  }

  function removeApp(id: string) {
    setApps((prev) => prev.filter((app) => app.id !== id))
  }

  return { apps, addApp, updateApp, removeApp, store }
}

export function toDraft(app: AppEntry): DraftApp {
  return {
    name: app.name,
    command: app.command,
    url: app.url,
    description: app.description,
    autoStart: app.autoStart,
    accent: app.accent,
    preview: app.preview,
    previewImage: app.previewImage,
  }
}
