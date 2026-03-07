import { useState, useCallback, type ReactNode } from "react"
import { SidebarContext } from "./sidebar-context"

const SIDEBAR_STORAGE_KEY = "nucleus:left-sidebar-width"
const DEFAULT_SIDEBAR_WIDTH = 300
const MIN_SIDEBAR_WIDTH = 240
const MAX_SIDEBAR_WIDTH = 420

function clampSidebarWidth(width: number) {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width))
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [width, setWidthState] = useState(() => {
    if (typeof window === "undefined") {
      return DEFAULT_SIDEBAR_WIDTH
    }

    const storedWidth = window.localStorage.getItem(SIDEBAR_STORAGE_KEY)
    const parsedWidth = storedWidth ? Number(storedWidth) : NaN

    return Number.isFinite(parsedWidth)
      ? clampSidebarWidth(parsedWidth)
      : DEFAULT_SIDEBAR_WIDTH
  })

  const toggle = useCallback(() => setIsCollapsed((prev) => !prev), [])
  const expand = useCallback(() => setIsCollapsed(false), [])
  const collapse = useCallback(() => setIsCollapsed(true), [])
  const setWidth = useCallback((nextWidth: number) => {
    const clampedWidth = clampSidebarWidth(nextWidth)
    setWidthState(clampedWidth)

    if (typeof window !== "undefined") {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(clampedWidth))
    }
  }, [])

  return (
    <SidebarContext.Provider value={{ isCollapsed, width, toggle, expand, collapse, setWidth }}>
      {children}
    </SidebarContext.Provider>
  )
}
