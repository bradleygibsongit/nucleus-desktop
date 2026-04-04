import { useState, useEffect, useCallback, useRef } from "react"
import { desktop } from "@/desktop/client"
import { FileChangesList, FileChangesToolbar, FileTreeViewer, useFileChangesState } from "@/features/version-control/components"
import { useFileTreeStore } from "@/features/workspace/store"
import { useTabStore } from "@/features/editor/store"
import { useCurrentProjectWorktree } from "@/features/shared/hooks"
import {
  useProjectGitBranches,
  useProjectGitChanges,
  useProjectGitPullRequestChecks,
} from "@/features/shared/hooks"
import { PullRequestChecksPanel } from "./PullRequestChecksPanel"
import { getChecksTabBadgeCount } from "./pullRequestChecks"
import { useRightSidebar } from "./useRightSidebar"
import { SidebarShell } from "./SidebarShell"
import { SourceControlActionGroup } from "./AppHeader"
import { cn } from "@/lib/utils"

interface RightSidebarProps {
  activeView?: "chat" | "settings" | "automations"
}

const RIGHT_SIDEBAR_TABS: Array<{
  key: "files" | "changes" | "checks"
  label: string
}> = [
  { key: "files", label: "Files" },
  { key: "changes", label: "Changes" },
  { key: "checks", label: "Checks" },
]

export function RightSidebar({ activeView = "chat" }: RightSidebarProps) {
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [fileImportError, setFileImportError] = useState<string | null>(null)
  const [isImportingFiles, setIsImportingFiles] = useState(false)
  const previousPendingChecksKeyRef = useRef<string | null>(null)
  const { isAvailable, isCollapsed, width, setWidth, activeTab, setActiveTab, expand } = useRightSidebar()
  const { selectedWorktreeId, selectedWorktree, selectedWorktreePath } = useCurrentProjectWorktree()
  const {
    activeProjectPath,
    dataByProjectPath,
    loadingByProjectPath,
    initialize: initializeFileTreeStore,
    setActiveProjectPath,
    refreshActiveProject,
  } = useFileTreeStore()
  const {
    initialize: initializeTabs,
    isInitialized: isTabsInitialized,
    openDiff,
    openFile,
    switchProject,
  } = useTabStore()
  const { branchData } = useProjectGitBranches(selectedWorktreePath, { enabled: Boolean(selectedWorktreePath) })
  const {
    changes: projectChanges,
    isLoading: isChangesLoading,
    loadError: changesError,
  } = useProjectGitChanges(selectedWorktreePath, { enabled: activeTab === "changes" })
  const openPullRequest = branchData?.openPullRequest ?? null
  const shouldLoadChecks = openPullRequest?.state === "open"
  const {
    checks: pullRequestChecks,
    isLoading: isPullRequestChecksLoading,
    loadError: pullRequestChecksError,
  } = useProjectGitPullRequestChecks(selectedWorktreePath, {
    enabled: Boolean(selectedWorktreePath) && shouldLoadChecks,
  })
  const fileChangesState = useFileChangesState(projectChanges)
  const checksTabBadgeCount = getChecksTabBadgeCount(openPullRequest, pullRequestChecks)

  const fileTreeData = activeProjectPath ? (dataByProjectPath[activeProjectPath] ?? {}) : {}
  const isFileTreeLoading = activeProjectPath ? (loadingByProjectPath[activeProjectPath] ?? false) : false

  // Switch project tabs and load files when selected project changes
  useEffect(() => {
    void initializeTabs()
  }, [initializeTabs])

  useEffect(() => {
    if (!isTabsInitialized) {
      return
    }

    switchProject(selectedWorktreeId ?? null)
  }, [isTabsInitialized, selectedWorktreeId, switchProject])

  useEffect(() => {
    void initializeFileTreeStore()
  }, [initializeFileTreeStore])

  useEffect(() => {
    setFileImportError(null)
    setIsImportingFiles(false)
  }, [selectedWorktreePath])

  useEffect(() => {
    setIsInitialLoad(true)

    void setActiveProjectPath(selectedWorktreePath ?? null).finally(() => {
      setIsInitialLoad(false)
    })
  }, [selectedWorktreePath, setActiveProjectPath])

  useEffect(() => {
    const nextPendingChecksKey =
      selectedWorktreePath &&
      openPullRequest?.state === "open" &&
      openPullRequest.checksStatus === "pending"
        ? `${selectedWorktreePath}:${openPullRequest.number}`
        : null

    console.debug("[RightSidebar] checks:auto-open:evaluate", {
      selectedWorktreePath,
      activeTab,
      isCollapsed,
      pullRequestNumber: openPullRequest?.number ?? null,
      pullRequestState: openPullRequest?.state ?? null,
      checksStatus: openPullRequest?.checksStatus ?? null,
      previousPendingChecksKey: previousPendingChecksKeyRef.current,
      nextPendingChecksKey,
    })

    if (nextPendingChecksKey && previousPendingChecksKeyRef.current !== nextPendingChecksKey) {
      console.debug("[RightSidebar] checks:auto-open:trigger", {
        nextPendingChecksKey,
      })
      expand()
      setActiveTab("checks")
    }

    previousPendingChecksKeyRef.current = nextPendingChecksKey
  }, [
    activeTab,
    expand,
    isCollapsed,
    openPullRequest?.checksStatus,
    openPullRequest?.number,
    openPullRequest?.state,
    selectedWorktreePath,
    setActiveTab,
  ])

  const handleExternalFileDrop = useCallback(
    async (sourcePaths: string[], targetDirectory: string) => {
      if (!selectedWorktreePath) {
        return
      }

      setIsImportingFiles(true)
      setFileImportError(null)
      console.debug("[file-tree-drop] import requested", {
        projectPath: selectedWorktreePath,
        targetDirectory,
        sourcePaths,
      })

      try {
        await desktop.fs.copyPathsIntoDirectory(sourcePaths, targetDirectory)
        console.debug("[file-tree-drop] import succeeded", {
          targetDirectory,
          sourcePaths,
        })
        await refreshActiveProject()
      } catch (error) {
        console.error("Failed to import dropped files into project:", error)
        setFileImportError(
          error instanceof Error ? error.message : "Couldn't add those files to the project."
        )
      } finally {
        setIsImportingFiles(false)
      }
    },
    [refreshActiveProject, selectedWorktreePath]
  )

  if (!isAvailable || isCollapsed || activeView !== "chat") {
    return null
  }

  return (
    <SidebarShell
      width={width}
      setWidth={setWidth}
      isCollapsed={isCollapsed}
      side="right"
      sizeConstraintClass="min-w-[300px] max-w-[560px]"
    >
      {/* Toolbar header */}
      <div className="flex h-11 shrink-0 items-center justify-end border-b border-sidebar-border/70 px-3">
        <div className="drag-region min-w-0 flex-1 self-stretch" />
        <SourceControlActionGroup projectPath={selectedWorktreePath} />
      </div>

      {/* Tab header */}
      <div className="shrink-0 px-3 py-1.5">
        <div className="flex items-center gap-1">
          {RIGHT_SIDEBAR_TABS.map(({ key, label }) => {
            const isActive = activeTab === key

            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={cn(
                  "inline-flex h-7 items-center gap-1 rounded-lg px-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[var(--sidebar-item-active)] text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/56 hover:bg-[var(--sidebar-item-hover)] hover:text-sidebar-foreground"
                )}
              >
                <span>{label}</span>
                {key === "changes" && projectChanges.length > 0 ? (
                  <span
                    className={cn(
                      "text-[11px] leading-none",
                      isActive
                        ? "text-sidebar-accent-foreground/70"
                        : "text-sidebar-foreground/40"
                    )}
                  >
                    {projectChanges.length}
                  </span>
                ) : null}
                {key === "checks" && checksTabBadgeCount > 0 ? (
                  <span
                    className={cn(
                      "text-[11px] leading-none",
                      isActive
                        ? "text-sidebar-accent-foreground/70"
                        : "text-sidebar-foreground/40"
                    )}
                  >
                    {checksTabBadgeCount}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      {/* Changes toolbar — fixed below tabs, only visible on changes tab with groups */}
      {activeTab === "changes" && projectChanges.length > 0 && (
        <div className="shrink-0 border-b border-sidebar-border/70 py-1">
          <FileChangesToolbar handle={fileChangesState} />
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="app-scrollbar-sm min-h-0 flex-1 overflow-y-auto px-1.5 py-1.5">
          {activeTab === "files" ? (
            isInitialLoad || isFileTreeLoading ? (
              <div className="flex items-center justify-center py-8">
                <span className="text-sm text-muted-foreground">Loading files...</span>
              </div>
            ) : !selectedWorktree ? (
              <div className="flex items-center justify-center py-8">
                <span className="text-sm text-muted-foreground">Select a worktree to view files</span>
              </div>
            ) : (
              <div className="space-y-2">
                {isImportingFiles ? (
                  <div className="rounded-xl border border-border/70 bg-card px-2.5 py-2 text-xs leading-5 text-muted-foreground">
                    Importing dropped files into the project...
                  </div>
                ) : null}

                {fileImportError ? (
                  <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-2.5 py-2 text-xs leading-5 text-destructive">
                    {fileImportError}
                  </div>
                ) : null}

                {Object.keys(fileTreeData).length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <span className="text-sm text-muted-foreground">No files found</span>
                  </div>
                ) : (
                  <FileTreeViewer
                    data={fileTreeData}
                    initialExpanded={["root"]}
                    projectPath={selectedWorktree.path}
                    onFileClick={openFile}
                    onExternalDrop={handleExternalFileDrop}
                  />
                )}
              </div>
            )
          ) : activeTab === "changes" ? (
            !selectedWorktree ? (
              <div className="flex items-center justify-center py-8">
                <span className="text-sm text-muted-foreground">Select a worktree to view changes</span>
              </div>
            ) : isChangesLoading ? (
              <div className="flex items-center justify-center py-8">
                <span className="text-sm text-muted-foreground">Loading changes...</span>
              </div>
            ) : changesError ? (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-2.5 py-2 text-xs leading-5 text-destructive">
                {changesError}
              </div>
            ) : projectChanges.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 py-8 text-center">
                <div className="rounded-full border border-border/70 bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                  Working tree clean
                </div>
                <span className="max-w-56 text-sm text-muted-foreground">
                  This worktree has no local file changes right now.
                </span>
              </div>
            ) : (
              <div className="px-1.5 py-1">
                <FileChangesList
                  changes={projectChanges}
                  state={fileChangesState}
                  onFileClick={(file) => {
                    const fileName = file.path.split("/").pop() ?? file.path
                    openDiff(file.path, fileName, file.previousPath)
                  }}
                />
              </div>
            )
          ) : !selectedWorktree ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-sm text-muted-foreground">Select a worktree to view checks</span>
            </div>
          ) : (
            <PullRequestChecksPanel
              pullRequest={openPullRequest}
              checks={pullRequestChecks}
              isLoading={isPullRequestChecksLoading}
              loadError={pullRequestChecksError ?? openPullRequest?.checksError ?? null}
            />
          )}
        </div>
      </div>
    </SidebarShell>
  )
}
