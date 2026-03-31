import { useEffect, useMemo, useRef } from "react"
import { AutomationsPage } from "@/features/automations/components/AutomationsPage"
import { ChatContainer, TabBar } from "@/features/chat/components"
import { FileViewer, ProjectDiffViewer } from "@/features/editor/components"
import { SettingsPage } from "@/features/settings/components/SettingsPage"
import { useTabStore } from "@/features/editor/store"
import { useCurrentProjectWorktree } from "@/features/shared/hooks"
import { useChatStore } from "@/features/chat/store"
import { Button } from "@/features/shared/components/ui/button"
import { useProjectStore } from "@/features/workspace/store"
import type { Tab } from "@/features/chat/types"
import type { SettingsSectionId } from "@/features/settings/config"
import { UpdateBanner } from "@/features/updates/components/UpdateBanner"

const OPEN_PROJECT_SETTINGS_EVENT = "nucleus:open-project-settings"

interface DiffTabContentProps {
  tab: Tab
}

function DiffTabContent({ tab }: DiffTabContentProps) {
  const { selectedWorktreePath } = useCurrentProjectWorktree()

  return (
    <ProjectDiffViewer
      filename={tab.title}
      projectPath={selectedWorktreePath}
      filePath={tab.filePath}
      previousFilePath={tab.previousFilePath}
    />
  )
}

interface TabContentProps {
  tab: Tab | undefined
}

function TabContent({ tab }: TabContentProps) {
  if (!tab || tab.type === "chat-session") {
    return <ChatContainer />
  }

  if (tab.type === "file") {
    return <FileViewer filename={tab.title} filePath={tab.filePath} />
  }

  return <DiffTabContent tab={tab} />
}
interface MainContentProps {
  activeView: "chat" | "settings" | "automations"
  activeSettingsSection: SettingsSectionId
}

function NoWorkspaceSelectedState({
  projectId,
  onCreateWorkspace,
}: {
  projectId: string
  onCreateWorkspace: () => void
}) {
  return (
    <div className="flex h-full items-center justify-center px-6 py-10">
      <div className="w-full max-w-xl rounded-[28px] border border-border/70 bg-card/95 px-8 py-10 text-center shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-muted/70 text-lg font-semibold text-foreground shadow-sm">
          N
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">No workspace selected</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          This project does not have a workspace yet. Create one to start chat, files, changes,
          and terminal workflows.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button type="button" onClick={onCreateWorkspace}>
            Create workspace
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent(OPEN_PROJECT_SETTINGS_EVENT, {
                  detail: { projectId },
                })
              )
            }
          >
            Project settings
          </Button>
        </div>
      </div>
    </div>
  )
}

export function MainContent({ activeView, activeSettingsSection }: MainContentProps) {
  const { focusedProjectId, activeWorktreeId, activeWorktreePath } = useCurrentProjectWorktree()
  const { getProjectChat, openDraftSession, createOptimisticSession, selectSession } = useChatStore()
  const createWorktree = useProjectStore((state) => state.createWorktree)
  const {
    initialize,
    isInitialized,
    switchProject,
    tabs,
    activeTabId,
    setActiveTab,
    closeTab,
    openChatSession,
    updateChatSessionTitle,
  } = useTabStore()
  const lastInitializedWorktreeIdRef = useRef<string | null>(null)
  const lastOpenedSessionIdRef = useRef<string | null>(null)

  useEffect(() => {
    void initialize()
  }, [initialize])

  useEffect(() => {
    if (!isInitialized) {
      return
    }

    switchProject(activeWorktreeId)
  }, [activeWorktreeId, isInitialized, switchProject])

  useEffect(() => {
    if (!isInitialized || !focusedProjectId || !activeWorktreePath) {
      lastInitializedWorktreeIdRef.current = null
      lastOpenedSessionIdRef.current = null
      return
    }

    const worktreeChat = getProjectChat(focusedProjectId)
    const currentTabs = useTabStore.getState().tabs
    const activeSession =
      worktreeChat.sessions.find((session) => session.id === worktreeChat.activeSessionId) ??
      worktreeChat.sessions[0] ??
      null

    const activeChatTab = useTabStore
      .getState()
      .tabs.find((tab) => tab.type === "chat-session" && tab.sessionId === activeSession?.id)

    if (lastInitializedWorktreeIdRef.current !== activeWorktreeId) {
      lastInitializedWorktreeIdRef.current = activeWorktreeId
      lastOpenedSessionIdRef.current = activeSession?.id ?? null

      if (!currentTabs.length) {
        if (activeSession && !activeChatTab) {
          openChatSession(activeSession.id, activeSession.title)
          return
        }

        if (!activeSession) {
          const optimisticSession = createOptimisticSession(focusedProjectId, activeWorktreePath)
          if (optimisticSession) {
            lastOpenedSessionIdRef.current = optimisticSession.id
            openChatSession(optimisticSession.id, optimisticSession.title)
          }
        }
      }
      return
    }

    if (
      activeSession &&
      activeSession.id !== lastOpenedSessionIdRef.current &&
      !activeChatTab
    ) {
      openChatSession(activeSession.id, activeSession.title)
    }

    lastOpenedSessionIdRef.current = activeSession?.id ?? null

    for (const tab of tabs) {
      if (tab.type !== "chat-session" || !tab.sessionId) {
        continue
      }

      const matchingSession = worktreeChat.sessions.find((session) => session.id === tab.sessionId)
      const nextTitle = matchingSession?.title?.trim() || "New chat"
      if (matchingSession && nextTitle !== tab.title) {
        updateChatSessionTitle(tab.sessionId, matchingSession.title)
      }
    }
  }, [
    getProjectChat,
    isInitialized,
    openChatSession,
    createOptimisticSession,
    focusedProjectId,
    activeWorktreePath,
    activeWorktreeId,
    tabs,
    updateChatSessionTitle,
  ])

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? tabs[0],
    [activeTabId, tabs]
  )

  useEffect(() => {
    if (!focusedProjectId || activeTab?.type !== "chat-session" || !activeTab.sessionId) {
      return
    }

    void selectSession(focusedProjectId, activeTab.sessionId)
  }, [activeTab, focusedProjectId, selectSession])

  const handleTabClose = (tabId: string) => {
    const closingTab = tabs.find((tab) => tab.id === tabId)
    const remainingTabs = tabs.filter((tab) => tab.id !== tabId)
    closeTab(tabId)

    if (!focusedProjectId || !activeWorktreePath || closingTab?.type !== "chat-session") {
      return
    }

    if (activeTabId !== tabId) {
      return
    }

    const nextActiveTab = remainingTabs[remainingTabs.length - 1] ?? null
    if (nextActiveTab?.type === "chat-session" && nextActiveTab.sessionId) {
      void selectSession(focusedProjectId, nextActiveTab.sessionId)
      return
    }

    if (!nextActiveTab) {
      const optimisticSession = createOptimisticSession(focusedProjectId, activeWorktreePath)
      if (optimisticSession) {
        openChatSession(optimisticSession.id, optimisticSession.title)
        return
      }
    }

    void openDraftSession(focusedProjectId, activeWorktreePath)
  }

  if (activeView === "settings") {
    return (
      <main className="flex-1 min-w-80 bg-main-content text-main-content-foreground overflow-hidden flex flex-col">
        <UpdateBanner />
        <SettingsPage activeSection={activeSettingsSection} />
      </main>
    )
  }

  if (activeView === "automations") {
    return (
      <main className="flex-1 min-w-80 bg-main-content text-main-content-foreground overflow-hidden flex flex-col">
        <UpdateBanner />
        <AutomationsPage />
      </main>
    )
  }

  if (focusedProjectId && activeWorktreeId == null) {
    return (
      <main className="flex-1 min-w-80 bg-main-content text-main-content-foreground overflow-hidden flex flex-col">
        <UpdateBanner />
        <NoWorkspaceSelectedState
          projectId={focusedProjectId}
          onCreateWorkspace={() => {
            void createWorktree(focusedProjectId)
          }}
        />
      </main>
    )
  }

  return (
    <main className="flex-1 min-w-80 bg-main-content text-main-content-foreground overflow-hidden flex flex-col">
      <UpdateBanner />
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId ?? tabs[0]?.id ?? ""}
        onTabChange={setActiveTab}
        onTabClose={handleTabClose}
      />
      <div className="flex-1 overflow-hidden">
        <TabContent tab={activeTab} />
      </div>
    </main>
  )
}
