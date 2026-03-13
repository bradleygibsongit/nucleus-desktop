import { useState, useCallback, type ReactNode } from "react"
import { RightSidebarContext } from "./right-sidebar-context"

export function RightSidebarProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(true)

  const toggle = useCallback(() => setIsCollapsed((prev) => !prev), [])
  const expand = useCallback(() => setIsCollapsed(false), [])
  const collapse = useCallback(() => setIsCollapsed(true), [])

  return (
    <RightSidebarContext.Provider value={{ isCollapsed, toggle, expand, collapse }}>
      {children}
    </RightSidebarContext.Provider>
  )
}
