import { ChatCircle, Plus, Terminal } from "@/components/icons"
import { useChatStore } from "@/features/chat/store"
import { useTabStore } from "@/features/editor/store"
import { useCurrentProjectWorktree } from "@/features/shared/hooks"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/features/shared/components/ui/dropdown-menu"
import { LayoutGroup } from "framer-motion"
import { cn } from "@/lib/utils"
import { getTerminalTabLabel } from "@/features/terminal/utils/terminalTabs"
import { TabItem } from "./TabItem"
import type { HarnessId, Tab } from "../types"

interface TabBarProps {
  tabs: Tab[]
  activeTabId: string
  onTabChange: (tabId: string) => void
  onTabClose?: (tabId: string) => void
}

export function TabBar({ tabs, activeTabId, onTabChange, onTabClose }: TabBarProps) {
  const { selectedWorktreeId, selectedWorktreePath } = useCurrentProjectWorktree()
  const createOptimisticSession = useChatStore((state) => state.createOptimisticSession)
  const getProjectChat = useChatStore((state) => state.getProjectChat)
  const openChatSession = useTabStore((state) => state.openChatSession)
  const openTerminalTab = useTabStore((state) => state.openTerminalTab)

  const worktreeChat = selectedWorktreeId ? getProjectChat(selectedWorktreeId) : null

  const handleCreateChatTab = () => {
    if (!selectedWorktreeId || !selectedWorktreePath) {
      return
    }

    const session = createOptimisticSession(selectedWorktreeId, selectedWorktreePath)
    if (session) {
      openChatSession(session.id, session.title)
    }
  }

  const handleCreateTerminalTab = () => {
    if (!selectedWorktreeId) {
      return
    }

    openTerminalTab(selectedWorktreeId)
  }

  return (
    <div className="flex h-10 items-center border-b border-sidebar-border bg-sidebar px-2 gap-0.5">
      <div className="flex h-full flex-1 items-center overflow-x-auto gap-0.5">
        <LayoutGroup>
          {tabs.map((tab) => {
            let harnessId: HarnessId | undefined
            if (tab.type === "chat-session" && tab.sessionId && worktreeChat) {
              const session = worktreeChat.sessions.find((s) => s.id === tab.sessionId)
              harnessId = session?.harnessId
            }

            return (
              <TabItem
                key={tab.id}
                type={tab.type}
                title={tab.type === "terminal" ? getTerminalTabLabel(tab, tabs) : tab.title}
                harnessId={harnessId}
                isActive={tab.id === activeTabId}
                onClick={() => onTabChange(tab.id)}
                onClose={onTabClose ? () => onTabClose(tab.id) : undefined}
              />
            )
          })}
        </LayoutGroup>

        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={!selectedWorktreeId}
            className={cn(
              "ml-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
              "text-muted-foreground hover:bg-muted/30 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            )}
            aria-label="Open new tab menu"
          >
            <Plus size={14} />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="w-[180px] border border-border/70 bg-card p-1 shadow-lg"
          >
            <DropdownMenuItem
              onClick={handleCreateChatTab}
              disabled={!selectedWorktreePath}
              className="min-h-8 gap-2 px-2 py-1"
            >
              <ChatCircle size={14} />
              <span>New chat</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleCreateTerminalTab}
              className="min-h-8 gap-2 px-2 py-1"
            >
              <Terminal size={14} />
              <span>New terminal</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
