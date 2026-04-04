import type { Tab } from "@/features/chat/types"

export function getVisibleTab(tabs: Tab[], activeTabId: string | null): Tab | undefined {
  if (!activeTabId) {
    return undefined
  }

  return tabs.find((tab) => tab.id === activeTabId) ?? tabs[0]
}
