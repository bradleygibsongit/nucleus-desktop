import type { Tab } from "@/features/chat/types"

const TERMINAL_SESSION_PREFIX = "project-terminal:"

export function createTerminalTab(): Tab {
  return {
    id: crypto.randomUUID(),
    type: "terminal",
    title: "Terminal",
  }
}

export function isTerminalTab(tab: Tab): boolean {
  return tab.type === "terminal"
}

export function getTerminalSessionId(tabId: string): string {
  return `${TERMINAL_SESSION_PREFIX}${tabId}`
}

export function getTerminalTabLabel(tab: Tab, tabs: Tab[]): string {
  const terminalTabs = tabs.filter(isTerminalTab)
  const terminalIndex = terminalTabs.findIndex((candidate) => candidate.id === tab.id)

  if (terminalIndex <= 0 && terminalTabs.length <= 1) {
    return "Terminal"
  }

  return `Terminal ${terminalIndex + 1}`
}
