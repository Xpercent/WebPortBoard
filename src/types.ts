export type AccentKey =
  | "indigo"
  | "violet"
  | "sky"
  | "emerald"
  | "amber"
  | "rose"

export type PreviewMode = "none" | "live" | "image"

export interface AppEntry {
  id: string
  name: string
  command: string
  url: string
  description: string
  /** dev server 启动时用 command 拉起进程，面板退出时一并结束 */
  autoStart: boolean
  accent: AccentKey
  preview: PreviewMode
  previewImage: string
  createdAt: number
}

export type DraftApp = Omit<AppEntry, "id" | "createdAt">

export const ACCENTS: Record<AccentKey, { label: string; from: string; to: string }> = {
  indigo: { label: "靛蓝", from: "#6366f1", to: "#8b5cf6" },
  violet: { label: "紫罗兰", from: "#a855f7", to: "#ec4899" },
  sky: { label: "天蓝", from: "#0ea5e9", to: "#22d3ee" },
  emerald: { label: "翡翠", from: "#10b981", to: "#84cc16" },
  amber: { label: "琥珀", from: "#f59e0b", to: "#f97316" },
  rose: { label: "玫红", from: "#f43f5e", to: "#fb7185" },
}

export const ACCENT_KEYS = Object.keys(ACCENTS) as AccentKey[]

export const PREVIEW_MODES: { value: PreviewMode; label: string; hint: string }[] = [
  { value: "none", label: "不显示", hint: "卡片用标识色首字母" },
  {
    value: "live",
    label: "实时页面",
    hint: "卡片里直接加载应用，点开不重新加载；需应用允许被内嵌",
  },
  { value: "image", label: "自定义图", hint: "上传或粘贴预览图" },
]
