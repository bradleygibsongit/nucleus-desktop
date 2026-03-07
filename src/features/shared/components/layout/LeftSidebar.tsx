import { useState, useEffect, useRef, useCallback } from "react"
import { AnimatePresence, motion, Reorder } from "framer-motion"
import {
  CaretRight,
  CircleDashed,
  Folder,
  FolderOpen,
  FolderSimple,
  FolderSimplePlus,
  GearSix,
  PlusSquare,
  X,
  Plus,
  Archive,
} from "@/components/icons"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/features/shared/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/features/shared/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/features/shared/components/ui/tooltip"
import { QuickStartModal } from "@/features/workspace/components/modals"
import { useProjectStore } from "@/features/workspace/store"
import { openFolderPicker } from "@/features/workspace/utils/folderDialog"
import { useChatStore } from "@/features/chat/store"
import { useSidebar } from "./useSidebar"
import { cn } from "@/lib/utils"
import type { Session } from "@/features/chat/types"
import type { Project } from "@/features/workspace/types"
import {
  SETTINGS_BACK_ICON,
  SETTINGS_SECTIONS,
  type SettingsSectionId,
} from "@/features/settings/config"

interface LeftSidebarProps {
  activeView?: "chat" | "settings"
  activeSettingsSection?: SettingsSectionId
  onOpenChat?: () => void
  onOpenSettings?: () => void
  onSelectSettingsSection?: (section: SettingsSectionId) => void
}

export function LeftSidebar({
  activeView = "chat",
  activeSettingsSection = "general",
  onOpenChat,
  onOpenSettings,
  onSelectSettingsSection,
}: LeftSidebarProps) {
  const [quickStartOpen, setQuickStartOpen] = useState(false)
  const [projectToRemove, setProjectToRemove] = useState<{ id: string; name: string } | null>(null)
  const [confirmArchiveSessionId, setConfirmArchiveSessionId] = useState<string | null>(null)
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null)
  const [orderedProjects, setOrderedProjects] = useState<Project[]>([])
  const restoredSessionsRef = useRef<Set<string>>(new Set())
  const orderedProjectsRef = useRef<Project[]>([])
  const { isCollapsed, width, setWidth } = useSidebar()
  const resizeStateRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const {
    projects,
    selectedProjectId,
    isLoading,
    loadProjects,
    addProject,
    removeProject,
    setProjectOrder,
    selectProject,
  } = useProjectStore()

  const {
    getProjectChat,
    openDraftSession,
    selectSession,
    archiveSession,
    initialize: initializeChat,
    loadSessionsForProject,
    currentSessionId,
    status,
  } = useChatStore()

  // Load projects on mount
  useEffect(() => {
    loadProjects()
    initializeChat()
  }, [loadProjects, initializeChat])

  // Auto-expand selected project
  useEffect(() => {
    if (selectedProjectId) {
      setExpandedProjects((prev) => new Set([...prev, selectedProjectId]))
    }
  }, [selectedProjectId])

  useEffect(() => {
    setOrderedProjects(projects)
    orderedProjectsRef.current = projects
  }, [projects])

  // Sync project paths and restore the persisted active session when a project is expanded
  useEffect(() => {
    for (const projectId of expandedProjects) {
      const project = projects.find((p) => p.id === projectId)
      const projectChat = getProjectChat(projectId)
      
      if (project?.path) {
        if (projectChat.sessions.length === 0) {
          // Fetch sessions from server if not already loaded
          loadSessionsForProject(projectId, project.path)
        } else if (
          projectChat.activeSessionId && 
          projectId === selectedProjectId &&
          !restoredSessionsRef.current.has(projectId)
        ) {
          // Sessions already loaded from persistence, restore the active session's messages
          restoredSessionsRef.current.add(projectId)
          selectSession(projectId, projectChat.activeSessionId)
        }
      }
    }
  }, [expandedProjects, projects, getProjectChat, loadSessionsForProject, selectSession, selectedProjectId])

  const handleOpenProject = async () => {
    const folderPath = await openFolderPicker()
    if (folderPath) {
      await addProject(folderPath)
    }
  }

  const handleRemoveClick = (e: React.MouseEvent, project: { id: string; name: string }) => {
    e.stopPropagation()
    setProjectToRemove(project)
  }

  const handleConfirmRemove = async () => {
    if (projectToRemove) {
      await removeProject(projectToRemove.id)
      setProjectToRemove(null)
    }
  }

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
  }

  const handleSelectSession = async (projectId: string, sessionId: string) => {
    setConfirmArchiveSessionId(null)
    onOpenChat?.()
    // First select the project
    selectProject(projectId)
    // Then select the session
    await selectSession(projectId, sessionId)
  }

  const handleArchiveIntent = async (
    e: React.MouseEvent,
    projectId: string,
    sessionId: string,
  ) => {
    e.stopPropagation()

    if (confirmArchiveSessionId === sessionId) {
      setConfirmArchiveSessionId(null)
      await archiveSession(projectId, sessionId)
      return
    }

    setConfirmArchiveSessionId(sessionId)
  }

  const handleProjectReorder = (nextProjects: Project[]) => {
    setOrderedProjects(nextProjects)
    orderedProjectsRef.current = nextProjects
  }

  const handleProjectDragEnd = async () => {
    const nextProjects = orderedProjectsRef.current
    if (nextProjects.length !== projects.length) {
      return
    }

    const didChange = nextProjects.some((project, index) => project.id !== projects[index]?.id)
    if (!didChange) {
      return
    }

    await setProjectOrder(nextProjects)
  }

  const formatSessionTitle = (session: Session | null | undefined): string => {
    if (!session) return "New Session"
    if (session.title) return session.title
    const date = new Date(session.createdAt)
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const BackIcon = SETTINGS_BACK_ICON
  const sidebarWidth = isCollapsed ? 48 : width
  const sidebarTopInset = isCollapsed ? 38 : 44
  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? orderedProjects[0] ?? null
  const expandedRowClass =
    "flex h-8 w-full items-center gap-2 rounded-lg px-1.5 text-left text-[13px] font-medium"
  const expandedRowIdleClass =
    "text-sidebar-foreground/68 hover:bg-[var(--sidebar-item-hover)] hover:text-sidebar-foreground"
  const expandedRowActiveClass =
    "bg-[var(--sidebar-item-active)] text-sidebar-accent-foreground"
  const glassSidebarClass =
    "bg-[var(--sidebar-glass)] supports-[backdrop-filter]:bg-[var(--sidebar-glass-strong)]"

  const stopResizing = useCallback(() => {
    resizeStateRef.current = null
    document.documentElement.style.removeProperty("cursor")
    document.documentElement.style.removeProperty("user-select")
    document.documentElement.style.removeProperty("-webkit-user-select")
    document.body.style.removeProperty("cursor")
    document.body.style.removeProperty("user-select")
    document.body.style.removeProperty("-webkit-user-select")
  }, [])

  useEffect(() => {
    return () => {
      stopResizing()
    }
  }, [stopResizing])

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const resizeState = resizeStateRef.current
      if (!resizeState) {
        return
      }

      const nextWidth = resizeState.startWidth + (event.clientX - resizeState.startX)
      setWidth(nextWidth)
    }

    const handlePointerUp = () => {
      stopResizing()
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)

    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
    }
  }, [setWidth, stopResizing])

  const handleResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isCollapsed) {
      return
    }

    event.preventDefault()

    resizeStateRef.current = {
      startX: event.clientX,
      startWidth: width,
    }

    window.getSelection()?.removeAllRanges()
    document.documentElement.style.cursor = "col-resize"
    document.documentElement.style.userSelect = "none"
    document.documentElement.style.setProperty("-webkit-user-select", "none")
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
    document.body.style.setProperty("-webkit-user-select", "none")
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleCreateThreadFromSelectedProject = async () => {
    if (!selectedProject) {
      return
    }

    setConfirmArchiveSessionId(null)
    onOpenChat?.()
    await selectProject(selectedProject.id)
    setExpandedProjects((prev) => new Set(prev).add(selectedProject.id))
    await openDraftSession(selectedProject.id, selectedProject.path)
  }

  const handleOpenAutomations = () => {
    onOpenChat?.()
  }

  if (activeView === "settings") {
    return (
      <aside
        style={{ width: sidebarWidth }}
        className={cn(
          "relative text-sidebar-foreground border-r border-sidebar-border/70 flex flex-col overflow-hidden shrink-0",
          glassSidebarClass,
          isCollapsed ? "w-12" : "min-w-[240px] max-w-[420px]",
        )}
      >
        <div
          data-tauri-drag-region
          className="absolute inset-x-0 top-0 z-0"
          style={{ height: sidebarTopInset }}
        />
        <div className="flex-1 overflow-y-auto">
          <div
            className={cn("px-2 pb-2", isCollapsed ? "space-y-1" : "space-y-2")}
            style={{ paddingTop: sidebarTopInset }}
          >
            {isCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onOpenChat?.()}
                    className="flex h-9 w-full items-center justify-center rounded-xl text-sidebar-foreground/68 hover:bg-[var(--sidebar-item-hover)] hover:text-sidebar-foreground"
                    aria-label="Back to app"
                  >
                    <BackIcon size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Back to app</TooltipContent>
              </Tooltip>
            ) : (
              <button
                type="button"
                onClick={() => onOpenChat?.()}
                className={cn(expandedRowClass, expandedRowIdleClass)}
              >
                <BackIcon size={16} className="shrink-0" />
                <span className="truncate">Back to app</span>
              </button>
            )}

            <nav aria-label="Settings navigation" className="space-y-0.5">
              {SETTINGS_SECTIONS.map((section) => {
                const Icon = section.icon
                const isActive = activeSettingsSection === section.id

                return isCollapsed ? (
                  <Tooltip key={section.id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => onSelectSettingsSection?.(section.id)}
                        className={cn(
                          "flex h-9 w-full items-center justify-center rounded-xl",
                          isActive
                            ? "bg-[var(--sidebar-item-active)] text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/62 hover:bg-[var(--sidebar-item-hover)] hover:text-sidebar-foreground",
                        )}
                        aria-label={section.label}
                      >
                        <Icon size={16} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">{section.label}</TooltipContent>
                  </Tooltip>
                ) : (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => onSelectSettingsSection?.(section.id)}
                    className={cn(
                      expandedRowClass,
                      isActive ? expandedRowActiveClass : expandedRowIdleClass,
                    )}
                  >
                    <Icon size={16} className="shrink-0" />
                    <span className="truncate">{section.label}</span>
                  </button>
                )
              })}
            </nav>
          </div>
        </div>
        {!isCollapsed ? (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
            onPointerDown={handleResizeStart}
            className="absolute inset-y-0 right-0 z-10 w-2 translate-x-1/2 cursor-col-resize"
          >
            <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors hover:bg-sidebar-border/90" />
          </div>
        ) : null}
      </aside>
    )
  }

  if (isLoading) {
    return (
      <aside
        style={{ width: sidebarWidth }}
        className={cn(
          "relative text-sidebar-foreground border-r border-sidebar-border/70 flex flex-col shrink-0",
          glassSidebarClass,
          isCollapsed ? "w-12" : "min-w-[240px] max-w-[420px]"
        )}
      >
        <div
          data-tauri-drag-region
          className="absolute inset-x-0 top-0 z-0"
          style={{ height: sidebarTopInset }}
        />
        {/* Loading state */}
        <div className="flex-1 flex items-center justify-center">
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      </aside>
    )
  }

  return (
      <aside
        style={{ width: sidebarWidth }}
        className={cn(
          "relative text-sidebar-foreground border-r border-sidebar-border/70 flex flex-col overflow-hidden shrink-0",
          glassSidebarClass,
          isCollapsed ? "w-12" : "min-w-[240px] max-w-[420px]"
        )}
      >
      <div
        data-tauri-drag-region
        className="absolute inset-x-0 top-0 z-0"
        style={{ height: sidebarTopInset }}
      />
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-2 pb-2" style={{ paddingTop: sidebarTopInset }}>
          {isCollapsed ? (
            <div className="mb-3 space-y-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => void handleCreateThreadFromSelectedProject()}
                    disabled={!selectedProject}
                    className={cn(
                      "flex h-9 w-full items-center justify-center rounded-xl",
                      selectedProject
                        ? "text-sidebar-foreground/76 hover:bg-[var(--sidebar-item-hover)] hover:text-sidebar-foreground"
                        : "cursor-not-allowed text-sidebar-foreground/28",
                    )}
                    aria-label="New thread"
                  >
                    <Plus size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">New thread</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleOpenAutomations}
                    className="flex h-9 w-full items-center justify-center rounded-xl text-sidebar-foreground/68 hover:bg-[var(--sidebar-item-hover)] hover:text-sidebar-foreground"
                    aria-label="Automations"
                  >
                    <CircleDashed size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Automations</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <div className="mb-3 space-y-0.5">
              <button
                type="button"
                onClick={() => void handleCreateThreadFromSelectedProject()}
                disabled={!selectedProject}
                className={cn(
                  expandedRowClass,
                  selectedProject
                    ? expandedRowIdleClass
                    : "cursor-not-allowed text-sidebar-foreground/32",
                )}
              >
                <Plus size={15} className="shrink-0" />
                <span className="truncate">New thread</span>
              </button>

              <button
                type="button"
                onClick={handleOpenAutomations}
                className={cn(expandedRowClass, expandedRowIdleClass)}
              >
                <CircleDashed size={15} className="shrink-0" />
                <span className="truncate">Automations</span>
              </button>
            </div>
          )}

          {isCollapsed ? (
            <div className="flex justify-center px-1 pb-2">
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger className="flex items-center justify-center rounded-md p-2 text-sidebar-foreground/60 hover:bg-[var(--sidebar-item-hover)] hover:text-sidebar-foreground cursor-pointer">
                      <FolderSimplePlus size={18} />
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="right">Add project</TooltipContent>
                </Tooltip>
                <DropdownMenuContent side="right" align="end" className="w-48">
                  <DropdownMenuItem onClick={handleOpenProject}>
                    <FolderSimple size={16} />
                    <span>Open project</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setQuickStartOpen(true)}>
                    <PlusSquare size={16} />
                    <span>Quick start</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="flex items-center justify-between px-2.5 pb-0.5">
              <span className="text-[13px] font-normal tracking-[0.04em] text-sidebar-foreground/58">
                Threads
              </span>
              <DropdownMenu>
                <Tooltip>
                    <TooltipTrigger asChild>
                    <DropdownMenuTrigger className="flex items-center justify-center rounded-xl p-2 text-sidebar-foreground/58 hover:bg-[var(--sidebar-item-hover)] hover:text-sidebar-foreground cursor-pointer">
                      <FolderSimplePlus size={16} />
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Add project</TooltipContent>
                </Tooltip>
                <DropdownMenuContent side="bottom" align="end" className="w-48">
                  <DropdownMenuItem onClick={handleOpenProject}>
                    <FolderSimple size={16} />
                    <span>Open project</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setQuickStartOpen(true)}>
                    <PlusSquare size={16} />
                    <span>Quick start</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {projects.length === 0 ? (
            !isCollapsed && (
              <div className="px-2.5 py-4 text-sm text-muted-foreground text-center">
                No projects yet.
                <br />
                <button
                  type="button"
                  onClick={handleOpenProject}
                  className="text-primary hover:underline mt-1"
                >
                  Add a project
                </button>
              </div>
            )
          ) : isCollapsed ? (
            <div className="space-y-0.5">
              {orderedProjects.map((project) => {
                const isSelected = selectedProjectId === project.id
                const isExpanded = expandedProjects.has(project.id)

                return (
                  <Tooltip key={project.id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => selectProject(project.id)}
                        className={cn(
                          "w-full flex items-center justify-center p-1.5 rounded-lg",
                          isSelected
                            ? "bg-[var(--sidebar-item-active)]"
                            : "hover:bg-[var(--sidebar-item-hover)]"
                        )}
                      >
                        {isExpanded ? <FolderOpen size={18} /> : <Folder size={18} />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">{project.name}</TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          ) : (
            <Reorder.Group
              axis="y"
              values={orderedProjects}
              onReorder={handleProjectReorder}
              className="space-y-0.5"
            >
              {orderedProjects.map((project) => {
                const isSelected = selectedProjectId === project.id
                const isExpanded = expandedProjects.has(project.id)
                const isHovered = hoveredProjectId === project.id
                const projectChat = getProjectChat(project.id)
                const archivedIds = new Set(projectChat.archivedSessionIds ?? [])
                const sessions = projectChat.sessions.filter(s => !archivedIds.has(s.id))
                const activeSessionId = projectChat.activeSessionId

                return (
                  <Reorder.Item
                    key={project.id}
                    value={project}
                    layout="position"
                    onDragEnd={() => void handleProjectDragEnd()}
                    className="list-none"
                    whileDrag={{
                      scale: 1.01,
                      boxShadow: "0 12px 30px rgba(0, 0, 0, 0.16)",
                    }}
                  >
                    {/* Project row */}
                    <motion.div
                      onHoverStart={() => setHoveredProjectId(project.id)}
                      onHoverEnd={() => setHoveredProjectId((current) => (current === project.id ? null : current))}
                      className={cn(
                        "group",
                        expandedRowClass,
                        expandedRowIdleClass,
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleProjectExpanded(project.id)}
                        className="relative flex h-[18px] w-[18px] shrink-0 items-center justify-center text-sidebar-foreground/55 hover:text-sidebar-foreground/80"
                      >
                        <motion.span
                          className="absolute inset-0 flex items-center justify-center"
                          animate={{ opacity: isHovered ? 0 : 1, scale: isHovered ? 0.88 : 1 }}
                          transition={{ duration: 0 }}
                        >
                          {isExpanded ? <FolderOpen size={15} /> : <Folder size={15} />}
                        </motion.span>
                        <motion.span
                          className="absolute inset-0 flex items-center justify-center"
                          animate={{
                            opacity: isHovered ? 1 : 0,
                            rotate: isExpanded ? 90 : 0,
                            scale: isHovered ? 1 : 0.88,
                          }}
                          transition={{ duration: 0 }}
                        >
                          <CaretRight size={14} />
                        </motion.span>
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleProjectExpanded(project.id)}
                        className="flex h-full min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <span className="truncate text-[13px] font-medium leading-none">
                          {project.name}
                        </span>
                      </button>

                      {/* Remove button */}
                      <button
                        type="button"
                        onClick={(e) => handleRemoveClick(e, project)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/20"
                        aria-label={`Remove ${project.name}`}
                        >
                          <X
                            size={14}
                            className="text-muted-foreground hover:text-destructive"
                          />
                        </button>
                    </motion.div>

                    {/* Sessions list (collapsible) */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          key={`${project.id}-sessions`}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{
                            height: "auto",
                            opacity: 1,
                            transition: {
                              height: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
                              opacity: { duration: 0.16, delay: 0.04 },
                              staggerChildren: 0.028,
                              delayChildren: 0.02,
                            },
                          }}
                          exit={{
                            height: 0,
                            opacity: 0,
                            transition: {
                              height: { duration: 0.18, ease: [0.4, 0, 1, 1] },
                              opacity: { duration: 0.12 },
                              staggerChildren: 0.018,
                              staggerDirection: -1,
                            },
                          }}
                          className="mt-1 space-y-0.5 overflow-hidden"
                        >
                        {sessions.length === 0 ? (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -3 }}
                          transition={{ duration: 0.16 }}
                          className="pl-10 pr-3 py-2.5 text-sm text-muted-foreground"
                        >
                            No threads
                          </motion.div>
                        ) : (
                          sessions
                            .filter((session): session is Session => session != null && typeof session.id === "string")
                            .map((session, index) => {
                              const isActiveSession = activeSessionId === session.id && isSelected
                              const isRunningSession =
                                session.id === currentSessionId &&
                                (status === "streaming" || status === "connecting")
                              const isConfirmingArchive = confirmArchiveSessionId === session.id
                              return (
                                <motion.div
                                  key={session.id}
                                  initial={{ opacity: 0, y: -6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -4 }}
                                  transition={{
                                    duration: 0.18,
                                    delay: index * 0.015,
                                    ease: [0.22, 1, 0.36, 1],
                                  }}
                                  onHoverEnd={() => {
                                    if (confirmArchiveSessionId === session.id) {
                                      setConfirmArchiveSessionId(null)
                                    }
                                  }}
                                  className={cn(
                                    "group/session h-8 flex items-center gap-2 rounded-md px-1.5",
                                    isActiveSession
                                      ? "bg-[var(--sidebar-item-active)] text-sidebar-foreground"
                                      : expandedRowIdleClass
                                  )}
                                >
                                  <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">
                                    <AnimatePresence mode="wait" initial={false}>
                                      {isRunningSession ? (
                                        <motion.span
                                          key="spinner"
                                          initial={{ opacity: 0, scale: 0.88 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          exit={{ opacity: 0, scale: 0.88 }}
                                          transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                                          className="flex h-[18px] w-[18px] items-center justify-center"
                                        >
                                          <motion.span
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 0.95, ease: "linear", repeat: Infinity }}
                                            className="flex items-center justify-center"
                                          >
                                            <span className="size-3.5 rounded-full border border-sidebar-foreground/18 border-t-sidebar-foreground/62" />
                                          </motion.span>
                                        </motion.span>
                                      ) : (
                                        <span className="h-[18px] w-[18px]" />
                                      )}
                                    </AnimatePresence>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleSelectSession(project.id, session.id)}
                                    className="h-full min-w-0 flex-1 text-left"
                                  >
                                    <span className="block truncate text-[13px] font-medium">
                                      {formatSessionTitle(session)}
                                    </span>
                                  </button>
                                  <div className="flex shrink-0 items-center justify-end">
                                    {isConfirmingArchive ? (
                                      <button
                                        type="button"
                                        onClick={(e) => void handleArchiveIntent(e, project.id, session.id)}
                                        className="rounded-full border border-border/70 bg-muted/60 px-2 py-0.5 text-[11px] font-medium tracking-tight text-destructive hover:bg-muted/80"
                                        aria-label="Confirm archive session"
                                      >
                                        Confirm
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={(e) => void handleArchiveIntent(e, project.id, session.id)}
                                        className="opacity-0 group-hover/session:opacity-100 rounded p-1 hover:bg-[var(--sidebar-item-hover)]"
                                        aria-label="Archive session"
                                      >
                                        <Archive size={14} className="text-muted-foreground" />
                                      </button>
                                    )}
                                  </div>
                                </motion.div>
                              )
                            })
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Reorder.Item>
                )
              })}
            </Reorder.Group>
          )}
        </div>
      </div>

      <div className="shrink-0 p-2">
        {isCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onOpenSettings?.()}
                className={cn(
                  "flex w-full items-center justify-center rounded-lg p-2",
                  activeView === "settings"
                    ? "bg-[var(--sidebar-item-active)] text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/62 hover:bg-[var(--sidebar-item-hover)] hover:text-sidebar-foreground"
                )}
                aria-label="Open settings"
              >
                <GearSix size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Settings</TooltipContent>
          </Tooltip>
        ) : (
          <button
            type="button"
            onClick={() => onOpenSettings?.()}
            className={cn(
              expandedRowClass,
              activeView === "settings"
                ? expandedRowActiveClass
                : expandedRowIdleClass
            )}
          >
            <GearSix size={16} className="shrink-0" />
            <span className="truncate">Settings</span>
          </button>
        )}
      </div>

      <QuickStartModal open={quickStartOpen} onOpenChange={setQuickStartOpen} />

      {!isCollapsed ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          onPointerDown={handleResizeStart}
          className="absolute inset-y-0 right-0 z-10 w-2 translate-x-1/2 cursor-col-resize"
        >
          <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors hover:bg-sidebar-border/90" />
        </div>
      ) : null}

      <AlertDialog open={!!projectToRemove} onOpenChange={(open) => !open && setProjectToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will only remove <strong>{projectToRemove?.name}</strong> from Nucleus.
              The folder and its contents will not be deleted from your computer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRemove}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  )
}
