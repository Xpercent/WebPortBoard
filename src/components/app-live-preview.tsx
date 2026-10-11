import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react"
import { AppFrame } from "@/components/app-runner"
import { cn } from "@/lib/utils"
import type { AppEntry } from "@/types"

const EXPAND_MS = 420
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)"
/** 时长与缓动只写这一处；是否开 transition 由 measure 按「这次是不是形态切换」决定 */
const CLIP_TRANSITION = ["left", "top", "width", "height", "border-radius"]
  .map((prop) => `${prop} ${EXPAND_MS}ms ${EASE}`)
  .join(", ")
const BOX_TRANSITION = `transform ${EXPAND_MS}ms ${EASE}`

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
  /** 上一次写入时的形态，用来区分「切换」和「跟随卡片位置」 */
  const writtenRef = useRef<boolean | null>(null)
  const [mounted, setMounted] = useState(false)
  /** 记录已加载完的 frameKey，换地址/重载后自动回到透明骨架，不用 effect 抢时序 */
  const [readyKey, setReadyKey] = useState<string | null>(null)

  const frameKey = `${app.url}|${reloadTick}`

  useEffect(() => {
    if (expanded) setMounted(true)
  }, [expanded])

  /** 卡片重渲染后预览框节点会被换掉，所以要重新查 */
  const findAnchor = useCallback(() => {
    if (!anchorRef.current?.isConnected) anchorRef.current = anchorOf(app.id)
    return anchorRef.current
  }, [app.id])

  const measure = useCallback(() => {
    const container = containerRef.current
    const clip = clipRef.current
    const box = boxRef.current
    if (!container || !clip || !box) return

    const c = container.getBoundingClientRect()
    let g = { x: 0, y: 0, w: c.width, h: c.height, dx: 0, s: 1 }

    if (!expanded) {
      const a = findAnchor()?.getBoundingClientRect()
      if (!a || a.width < 2 || a.height < 2) return
      // 按 cover 缩放：iframe 的布局视口恒等于主区域，两种形态间不会重排
      const s = Math.max(a.width / c.width, a.height / c.height)
      g = {
        x: a.left - c.left,
        y: a.top - c.top,
        w: a.width,
        h: a.height,
        dx: (a.width - c.width * s) / 2,
        s,
      }
    }

    const next = [c.width, c.height, g.x, g.y, g.w, g.h, g.dx, g.s].map((n) => n.toFixed(2)).join()
    if (next === appliedRef.current) return
    const switching = writtenRef.current !== null && writtenRef.current !== expanded
    writtenRef.current = expanded
    appliedRef.current = next

    // transition 和几何在同一次写入里一起给出：切换时动画，跟随时瞬时
    clip.style.transition = switching ? CLIP_TRANSITION : "none"
    box.style.transition = switching ? BOX_TRANSITION : "none"
    clip.style.left = `${g.x}px`
    clip.style.top = `${g.y}px`
    clip.style.width = `${g.w}px`
    clip.style.height = `${g.h}px`
    box.style.width = `${c.width}px`
    box.style.height = `${c.height}px`
    box.style.transform = `translate(${g.dx}px, 0) scale(${g.s})`
  }, [containerRef, expanded, findAnchor])

  useEffect(() => {
    if (mounted) return
    const anchor = findAnchor()
    if (!anchor) return
    const io = new IntersectionObserver(
      (entries) => entries.some((entry) => entry.isIntersecting) && setMounted(true),
      { rootMargin: "160px" },
    )
    io.observe(anchor)
    return () => io.disconnect()
  }, [findAnchor, mounted])

  // 切换必须在提交时同步写：标签页被遮挡时 rAF 会整个停摆，靠 rAF 就漏掉这一帧
  useLayoutEffect(measure, [measure, mounted])

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
      className={cn("absolute overflow-hidden", expanded ? "z-30" : "z-10 rounded-t-lg")}
    >
      <div ref={boxRef} className="absolute left-0 top-0 origin-top-left">
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
