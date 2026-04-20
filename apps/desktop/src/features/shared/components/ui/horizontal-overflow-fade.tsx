import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react"
import { cn } from "@/lib/utils"

interface HorizontalOverflowFadeProps {
  children: ReactNode
  className?: string
  viewportClassName?: string
  contentClassName?: string
  viewportRef?: RefObject<HTMLDivElement | null>
  contentRef?: RefObject<HTMLDivElement | null>
}

const SCROLL_EDGE_EPSILON = 2
const END_FADE_WIDTH_PX = 72
const END_FADE_SOLID_WIDTH_PX = 22
const END_FADE_RAMP_DISTANCE_PX = 88

export function HorizontalOverflowFade({
  children,
  className,
  viewportClassName,
  contentClassName,
  viewportRef,
  contentRef,
}: HorizontalOverflowFadeProps) {
  const internalViewportRef = useRef<HTMLDivElement | null>(null)
  const internalContentRef = useRef<HTMLDivElement | null>(null)
  const [endFadeProgress, setEndFadeProgress] = useState(0)

  const setViewportNode = useCallback((node: HTMLDivElement | null) => {
    internalViewportRef.current = node

    if (viewportRef) {
      viewportRef.current = node
    }
  }, [viewportRef])

  const setContentNode = useCallback((node: HTMLDivElement | null) => {
    internalContentRef.current = node

    if (contentRef) {
      contentRef.current = node
    }
  }, [contentRef])

  const syncFadeState = useCallback(() => {
    const viewport = internalViewportRef.current
    if (!viewport) {
      setEndFadeProgress(0)
      return
    }

    const maxScrollLeft = viewport.scrollWidth - viewport.clientWidth
    const hasOverflow = maxScrollLeft > SCROLL_EDGE_EPSILON
    const isAtEnd = viewport.scrollLeft >= maxScrollLeft - SCROLL_EDGE_EPSILON
    const hiddenRightPx = Math.max(0, maxScrollLeft - viewport.scrollLeft)

    if (!hasOverflow || isAtEnd) {
      setEndFadeProgress(0)
      return
    }

    setEndFadeProgress(Math.min(1, hiddenRightPx / END_FADE_RAMP_DISTANCE_PX))
  }, [])

  useEffect(() => {
    const viewport = internalViewportRef.current
    const content = internalContentRef.current

    if (!viewport) {
      return
    }

    syncFadeState()

    const handleScroll = () => {
      syncFadeState()
    }

    viewport.addEventListener("scroll", handleScroll, { passive: true })

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", syncFadeState)

      return () => {
        viewport.removeEventListener("scroll", handleScroll)
        window.removeEventListener("resize", syncFadeState)
      }
    }

    const observer = new ResizeObserver(() => {
      syncFadeState()
    })
    observer.observe(viewport)

    if (content) {
      observer.observe(content)
    }

    return () => {
      viewport.removeEventListener("scroll", handleScroll)
      observer.disconnect()
    }
  }, [syncFadeState])

  const showEndFade = endFadeProgress > 0.01
  const effectiveFadeWidth = END_FADE_WIDTH_PX * endFadeProgress
  const effectiveSolidWidth = END_FADE_SOLID_WIDTH_PX * endFadeProgress
  const endFadeMaskStyle = showEndFade
    ? {
        maskImage: `linear-gradient(90deg, black 0, black calc(100% - ${effectiveFadeWidth}px), transparent 100%)`,
        WebkitMaskImage: `linear-gradient(90deg, black 0, black calc(100% - ${effectiveFadeWidth}px), transparent 100%)`,
      }
    : undefined

  return (
    <div className={cn("relative min-w-0", className)}>
      <div
        ref={setViewportNode}
        style={endFadeMaskStyle}
        className={cn("app-scrollbar-hidden min-w-0 overflow-x-auto overflow-y-hidden", viewportClassName)}
      >
        <div ref={setContentNode} className={cn("min-w-max", contentClassName)}>
          {children}
        </div>
      </div>

      {showEndFade ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 flex"
          style={{
            width: END_FADE_WIDTH_PX,
            opacity: endFadeProgress,
            transition: "opacity 160ms cubic-bezier(0.23, 1, 0.32, 1)",
          }}
        >
          <div
            className="min-w-0 flex-1"
            style={{
              background: "linear-gradient(90deg, transparent 0%, var(--sidebar) 100%)",
            }}
          />
          <div
            className="shrink-0 bg-sidebar"
            style={{
              width: effectiveSolidWidth,
              boxShadow: "inset 12px 0 18px color-mix(in oklab, var(--sidebar) 84%, transparent)",
            }}
          />
        </div>
      ) : null}
    </div>
  )
}
