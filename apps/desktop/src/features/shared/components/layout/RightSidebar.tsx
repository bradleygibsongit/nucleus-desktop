import { useState, useEffect, useCallback, useRef } from "react"
import { desktop, type GitPullRequest } from "@/desktop/client"
import { CheckCircle, Folder, GitDiff, Globe } from "@/components/icons"
import { BrowserSidebar } from "@/features/browser/components/BrowserSidebar"
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
import { getChecksTabBadgeCount, shouldAutoOpenChecksTab } from "./pullRequestChecks"
import { useRightSidebar } from "./useRightSidebar"
import { SidebarShell } from "./SidebarShell"
import { RightSidebarEmptyState } from "./RightSidebarEmptyState"
import { LayoutGroup, motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { prewarmProjectData } from "@/features/shared/utils/prewarmProjectData"

interface RightSidebarProps {
  activeView?: "chat" | "settings" | "automations"
}

const RIGHT_SIDEBAR_TABS: Array<{
  key: "files" | "changes" | "checks" | "browser"
  label: string
  icon: typeof Folder
}> = [
  { key: "files", label: "Files", icon: Folder },
  { key: "changes", label: "Changes", icon: GitDiff },
  { key: "checks", label: "Checks", icon: CheckCircle },
  { key: "browser", label: "Browser", icon: Globe },
]
const COLLAPSED_HOVER_TRIGGER_WIDTH = 12

export function RightSidebar({ activeView = "chat" }: RightSidebarProps) {
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [fileImportError, setFileImportError] = useState<string | null>(null)
  const [isImportingFiles, setIsImportingFiles] = useState(false)
  const [isHoverPreviewOpen, setIsHoverPreviewOpen] = useState(false)
  const previousChecksStatusByPullRequestRef = useRef<
    Map<string, GitPullRequest["checksStatus"] | null>
  >(new Map())
  const { isAvailable, isCollapsed, width, setWidth, activeTab, setActiveTab, expand, toggle } = useRightSidebar()
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
  } = useProjectGitChanges(selectedWorktreePath, {
    enabled: Boolean(selectedWorktreePath) && activeView === "chat",
  })
  const openPullRequest = branchData?.openPullRequest ?? null
  const shouldLoadChecks = openPullRequest?.state === "open"
  const {
    checks: pullRequestChecks,
    comments: pullRequestComments,
    reviews: pullRequestReviews,
    reviewComments: pullRequestReviewComments,
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
    const pullRequestKey =
      selectedWorktreePath && openPullRequest?.state === "open"
        ? `${selectedWorktreePath}:${openPullRequest.number}`
        : null
    const previousChecksStatus = pullRequestKey
      ? (previousChecksStatusByPullRequestRef.current.get(pullRequestKey) ?? null)
      : null
    const nextChecksStatus = openPullRequest?.checksStatus ?? null

    if (pullRequestKey && shouldAutoOpenChecksTab(previousChecksStatus, nextChecksStatus)) {
      expand()
      setActiveTab("checks")
    }

    if (pullRequestKey) {
      previousChecksStatusByPullRequestRef.current.set(pullRequestKey, nextChecksStatus)
    }
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

  const handleTabIntent = useCallback(
    (tab: "files" | "changes" | "checks" | "browser") => {
      void prewarmProjectData(selectedWorktreeId, selectedWorktreePath, tab)
    },
    [selectedWorktreeId, selectedWorktreePath]
  )
  const handleHoverPreviewIntent = useCallback(() => {
    void prewarmProjectData(selectedWorktreeId, selectedWorktreePath, activeTab)
  }, [activeTab, selectedWorktreeId, selectedWorktreePath])

  useEffect(() => {
    if (!isCollapsed && isHoverPreviewOpen) {
      setIsHoverPreviewOpen(false)
    }
  }, [isCollapsed, isHoverPreviewOpen])

  useEffect(() => {
    if ((!isAvailable || activeView !== "chat") && isHoverPreviewOpen) {
      setIsHoverPreviewOpen(false)
    }
  }, [activeView, isAvailable, isHoverPreviewOpen])

  if (!isAvailable || activeView !== "chat") {
    return null
  }

  const renderSidebarBody = (isResizingTabs: boolean) => (
    <>
      <div className="shrink-0 px-3 py-1.5">
        <LayoutGroup id="right-sidebar-tabs">
          <div className="flex items-center gap-1">
            {RIGHT_SIDEBAR_TABS.map(({ key, label, icon: Icon }) => {
              const isActive = activeTab === key

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  onPointerEnter={() => handleTabIntent(key)}
                  className={cn(
                    "group relative inline-flex h-7 items-center gap-1 rounded-md px-1.5 py-1 text-xs",
                    !isResizingTabs && "transition-colors",
                    isActive
                      ? "text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/56 hover:bg-[var(--sidebar-item-hover)] hover:text-sidebar-foreground"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="rightSidebarActiveTab"
                      className="absolute inset-0 rounded-lg bg-[var(--sidebar-item-active)]"
                      transition={
                        isResizingTabs
                          ? { duration: 0 }
                          : { type: "spring", stiffness: 500, damping: 35, mass: 0.5 }
                      }
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    <Icon className="size-3.5 shrink-0" />
                    <span>{label}</span>
                  </span>
                  {key === "changes" && projectChanges.length > 0 ? (
                    <span
                      className={cn(
                        "relative z-10 text-[10px] leading-none",
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
                        "relative z-10 text-[10px] leading-none",
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
        </LayoutGroup>
      </div>

      {activeTab === "changes" && projectChanges.length > 0 ? (
        <div className="shrink-0 border-b border-sidebar-border/70 py-1">
          <FileChangesToolbar handle={fileChangesState} />
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col">
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col",
            activeTab === "browser"
              ? "overflow-hidden pt-1.5"
              : "app-scrollbar-sm overflow-y-auto px-1.5 py-1.5"
          )}
        >
          <div
            className={cn(
              "min-h-0 w-full flex-1",
              activeTab === "browser" ? "flex" : "hidden"
            )}
            aria-hidden={activeTab === "browser" ? undefined : true}
          >
            <BrowserSidebar />
          </div>

          {activeTab === "files" ? (
            isInitialLoad || isFileTreeLoading ? (
              <div className="flex items-center justify-center py-8">
                <span className="text-sm text-muted-foreground">Loading files...</span>
              </div>
            ) : !selectedWorktree ? (
              <RightSidebarEmptyState
                title="No project selected"
                description="Choose a worktree to browse files in this panel."
              />
            ) : (
              <div className="flex h-full flex-col gap-2">
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
                  <RightSidebarEmptyState
                    title="No files yet"
                    description="This project folder is empty right now."
                  />
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
          ) : activeTab === "browser" ? null : activeTab === "changes" ? (
            !selectedWorktree ? (
              <RightSidebarEmptyState
                title="No project selected"
                description="Choose a worktree to inspect local changes."
              />
            ) : isChangesLoading ? (
              <div className="flex items-center justify-center py-8">
                <span className="text-sm text-muted-foreground">Loading changes...</span>
              </div>
            ) : changesError ? (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-2.5 py-2 text-xs leading-5 text-destructive">
                {changesError}
              </div>
            ) : projectChanges.length === 0 ? (
              <RightSidebarEmptyState
                title="Working tree clean"
                description="This worktree has no local file changes right now."
              />
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
            <RightSidebarEmptyState
              title="No project selected"
              description="Choose a worktree to inspect pull request checks."
            />
          ) : (
            <PullRequestChecksPanel
              pullRequest={openPullRequest}
              checks={pullRequestChecks}
              comments={pullRequestComments}
              reviews={pullRequestReviews}
              reviewComments={pullRequestReviewComments}
              isLoading={isPullRequestChecksLoading}
              loadError={pullRequestChecksError ?? openPullRequest?.checksError ?? null}
            />
          )}
        </div>
      </div>
    </>
  )

  if (isCollapsed) {
    return (
      <>
        <div
          className="fixed top-11 right-0 bottom-0 z-30"
          style={{ width: COLLAPSED_HOVER_TRIGGER_WIDTH }}
          onMouseEnter={() => {
            handleHoverPreviewIntent()
            setIsHoverPreviewOpen(true)
          }}
        />
        {isHoverPreviewOpen ? (
          <div
            className="fixed top-11 right-0 bottom-0 z-30 flex flex-col overflow-hidden border-l border-sidebar-border bg-sidebar text-sidebar-foreground shadow-[-18px_0_48px_rgba(0,0,0,0.18)]"
            style={{ width }}
            onMouseEnter={() => setIsHoverPreviewOpen(true)}
            onMouseLeave={() => setIsHoverPreviewOpen(false)}
          >
            {renderSidebarBody(false)}
          </div>
        ) : null}
      </>
    )
  }

  return (
    <SidebarShell
      width={width}
      setWidth={setWidth}
      isCollapsed={isCollapsed}
      side="right"
      sizeConstraintClass={activeTab === "browser" ? "min-w-[420px]" : "min-w-[300px]"}
    >
      {({ isResizing }) => (
        <>
          {renderSidebarBody(isResizing)}
        </>
      )}
    </SidebarShell>
  )
}
