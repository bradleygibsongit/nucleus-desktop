import { useEffect, useLayoutEffect, useState, type ReactNode, type RefObject } from "react"
import { createPortal } from "react-dom"

interface ComposerFloatingOverlayProps {
  anchorRef: RefObject<HTMLElement | null>
  children: ReactNode
  offset?: number
}

interface OverlayPosition {
  left: number
  width: number
  top: number
}

function measureAnchor(anchor: HTMLElement, offset: number): OverlayPosition {
  const rect = anchor.getBoundingClientRect()

  return {
    left: rect.left,
    width: rect.width,
    top: Math.max(rect.top - offset, offset),
  }
}

export function ComposerFloatingOverlay({
  anchorRef,
  children,
  offset = 10,
}: ComposerFloatingOverlayProps) {
  const [position, setPosition] = useState<OverlayPosition | null>(null)
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setPortalRoot(document.body)
  }, [])

  useLayoutEffect(() => {
    const anchor = anchorRef.current
    if (!anchor) {
      setPosition(null)
      return
    }

    const updatePosition = () => {
      setPosition(measureAnchor(anchor, offset))
    }

    updatePosition()

    const resizeObserver = new ResizeObserver(updatePosition)
    resizeObserver.observe(anchor)

    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
    }
  }, [anchorRef, offset])

  if (!portalRoot || !position) {
    return null
  }

  return createPortal(
    <div
      className="pointer-events-none fixed z-[60]"
      style={{
        left: position.left,
        width: position.width,
        top: position.top,
        transform: "translateY(-100%)",
      }}
    >
      <div className="pointer-events-auto">
        {children}
      </div>
    </div>,
    portalRoot
  )
}
