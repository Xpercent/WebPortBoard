import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react"
import { AppFrame } from "@/components/app-runner"
import { cn } from "@/lib/utils"
import type { AppEntry } from "@/types"

/** 展开/收起期间才打开 transition，其余时间逐帧贴合卡片位置（滚动、hover 抬升都不滞后） */
const EXPAND_MS = 340

function anchorOf(id: string) {
  return document.querySelector<HTMLElement>(`[data-preview-anchor="${CSS.escape(id)}"]`)
}

/**
 * 卡片缩略和全屏共用同一个 iframe 节点：只改 transform 和裁剪框，
 * 节点始终挂在 main 下不被重新插入，所以点开应用不会重新加载页面。
 */
export function AppLivePreview({
  app,
  containerRef,
  expanded,
  reloadTick,
}: {
  app: AppEntry
  containerRef: RefObject<HTMLElement | null>
  expanded: boolean
  reloadTick: number
}) {
  const clipRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLElement | null>(null)
  const appliedRef = useRef("")
  const expandedRef = useRef(expanded)
  const [mounted, setMounted] = useState(false)
  /** 记录已加载完的 frameKey，换地址/重载后自动回到透明骨架，不用 effect 抢时序 */
  const [readyKey, setReadyKey] = useState<string | null>(null)
  const [animating, setAnimating] = useState(false)

  const frameKey = `${app.url}|${reloadTick}`

  useEffect(() => {
    expandedRef.current = expanded
    if (expanded) setMounted(true)
  }, [expanded])

  useEffect(() => {
    setAnimating(true)
    const timer = window.setTimeout(() => setAnimating(false), EXPAND_MS)
    return () => window.clearTimeout(timer)
  }, [expanded])

  const measure = useCallback(() => {
    const container = containerRef.current
    const clip = clipRef.current
    const box = boxRef.current
    if (!container || !clip || !box) return

    const c = container.getBoundingClientRect()
    let g = { x: 0, y: 0, w: c.width, h: c.height, dx: 0, dy: 0, s: 1 }

    if (!expandedRef.current) {
      if (!anchorRef.current?.isConnected) anchorRef.current = anchorOf(app.id)
      const a = anchorRef.current?.getBoundingClientRect()
      if (!a || a.width < 2 || a.height < 2) return
      // 按 cover 缩放：iframe 的布局视口恒等于主区域，两种形态间不会重排
      const s = Math.max(a.width / c.width, a.height / c.height)
      g = {
        x: a.left - c.left,
        y: a.top - c.top,
        w: a.width,
        h: a.height,
        dx: (a.width - c.width * s) / 2,
        dy: 0,
        s,
      }
    }

    const next = [c.width, c.height, g.x, g.y, g.w, g.h, g.dx, g.s].map((n) => n.toFixed(2)).join()
    if (next === appliedRef.current) return
    appliedRef.current = next

    clip.style.left = `${g.x}px`
    clip.style.top = `${g.y}px`
    clip.style.width = `${g.w}px`
    clip.style.height = `${g.h}px`
    box.style.width = `${c.width}px`
    box.style.height = `${c.height}px`
    box.style.transform = `translate(${g.dx}px, ${g.dy}px) scale(${g.s})`
  }, [app.id, containerRef])

  useEffect(() => {
    if (mounted) return
    if (!anchorRef.current?.isConnected) anchorRef.current = anchorOf(app.id)
    const anchor = anchorRef.current
    if (!anchor) return
    const io = new IntersectionObserver(
      (entries) => entries.some((entry) => entry.isIntersecting) && setMounted(true),
      { rootMargin: "160px" },
    )
    io.observe(anchor)
    return () => io.disconnect()
  }, [app.id, mounted])

  useLayoutEffect(measure, [measure])

  useEffect(() => {
    let frame = requestAnimationFrame(function loop() {
      measure()
      frame = requestAnimationFrame(loop)
    })
    return () => cancelAnimationFrame(frame)
  }, [measure])

  if (!mounted) return null

  return (
    <div
      ref={clipRef}
      style={{ pointerEvents: expanded ? "auto" : "none" }}
      className={cn(
        "absolute overflow-hidden",
        expanded ? "z-30" : "z-10 rounded-t-lg",
        animating &&
          "transition-[left,top,width,height,border-radius] duration-[340ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
      )}
    >
      <div
        ref={boxRef}
        className={cn(
          "absolute left-0 top-0 origin-top-left",
          animating &&
            "transition-transform duration-[340ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
        )}
      >
        <AppFrame
          key={frameKey}
          app={app}
          onLoad={() => setReadyKey(frameKey)}
          className={cn(
            "transition-opacity duration-300",
            readyKey === frameKey ? "opacity-100" : "opacity-0",
          )}
        />
      </div>
    </div>
  )
}
