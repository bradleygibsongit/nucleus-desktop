import { createContext } from "react"

export type RightSidebarTab = "files" | "changes" | "checks"

export interface RightSidebarContextValue {
  isAvailable: boolean
  isCollapsed: boolean
  width: number
  activeTab: RightSidebarTab
  toggle: () => void
  expand: () => void
  collapse: () => void
  setWidth: (width: number) => void
  setActiveTab: (tab: RightSidebarTab) => void
}

export const RightSidebarContext = createContext<RightSidebarContextValue | null>(null)
