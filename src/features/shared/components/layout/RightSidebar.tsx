import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { FileTreeViewer } from "@/features/version-control/components"
import { useProjectStore } from "@/features/workspace/store"
import { useTabStore } from "@/features/editor/store"
import { useChatStore } from "@/features/chat/store"
import { readProjectFiles } from "@/features/workspace/utils/fileSystem"
import { useRightSidebar } from "./useRightSidebar"
import type { FileTreeItem } from "@/features/version-control/types"
import { Button, Input } from "@/features/shared/components/ui"
import { cn } from "@/lib/utils"
import { Eye } from "@/components/icons"

interface RightSidebarProps {
  activeView?: "chat" | "settings" | "skills" | "automations"
}

type RightSidebarTab = "files" | "secrets"

interface SecretFieldState {
  value: string
  savedValue: string
  isVisible: boolean
}

const SECRET_FIELDS = [
  {
    key: "OPENAI_API_KEY",
    label: "OpenAI API Key",
    placeholder: "sk-...",
  },
  {
    key: "ANTHROPIC_API_KEY",
    label: "Anthropic API Key",
    placeholder: "sk-ant-...",
  },
  {
    key: "LINEAR_API_KEY",
    label: "Linear API Key",
    placeholder: "lin_api_...",
  },
] as const

function createInitialSecretsState(): Record<string, SecretFieldState> {
  return Object.fromEntries(
    SECRET_FIELDS.map((field) => [
      field.key,
      {
        value: "",
        savedValue: "",
        isVisible: false,
      },
    ])
  )
}

export function RightSidebar({ activeView = "chat" }: RightSidebarProps) {
  const [fileTreeData, setFileTreeData] = useState<Record<string, FileTreeItem>>({})
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [activeTab, setActiveTab] = useState<RightSidebarTab>("files")
  const [secretsByProject, setSecretsByProject] = useState<
    Record<string, Record<string, SecretFieldState>>
  >({})
  const { isCollapsed } = useRightSidebar()
  const { projects, selectedProjectId } = useProjectStore()
  const { openFile, switchProject } = useTabStore()
  const { onFileChange } = useChatStore()

  // Get the selected project
  const selectedProject = projects.find((p) => p.id === selectedProjectId)
  const selectedProjectSecrets = useMemo(() => {
    if (!selectedProjectId) {
      return createInitialSecretsState()
    }

    return secretsByProject[selectedProjectId] ?? createInitialSecretsState()
  }, [secretsByProject, selectedProjectId])
  
  // Track refresh timeout for debouncing
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load files function (showLoading only for initial load)
  const loadFiles = useCallback(async (isInitial = false) => {
    if (!selectedProject?.path) {
      setFileTreeData({})
      setIsInitialLoad(false)
      return
    }

    // Only show loading state on initial load
    if (isInitial) {
      setIsInitialLoad(true)
    }

    try {
      const data = await readProjectFiles(selectedProject.path)
      setFileTreeData(data)
    } catch (error) {
      console.error("Failed to load project files:", error)
      // Only clear on initial load failure, preserve existing data on refresh failure
      if (isInitial) {
        setFileTreeData({})
      }
    } finally {
      setIsInitialLoad(false)
    }
  }, [selectedProject?.path])

  // Debounced refresh (silent, no loading indicator)
  const scheduleRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current)
    }
    refreshTimeoutRef.current = setTimeout(() => {
      loadFiles(false) // Silent refresh
    }, 300) // Debounce 300ms to batch rapid changes
  }, [loadFiles])

  // Switch project tabs and load files when selected project changes
  useEffect(() => {
    switchProject(selectedProjectId ?? null)
    loadFiles(true) // Initial load with loading indicator
  }, [selectedProjectId, switchProject, loadFiles])

  // Subscribe to file change events from the active harness
  useEffect(() => {
    if (!selectedProject?.path) return

    const unsubscribe = onFileChange((event) => {
      // Check if the changed file is within the current project
      // Handle both absolute paths and relative paths
      const isAbsoluteMatch = event.file.startsWith(selectedProject.path)
      const isRelativePath = !event.file.startsWith("/")
      
      if (isAbsoluteMatch || isRelativePath) {
        scheduleRefresh()
      }
    })

    return () => {
      unsubscribe()
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
    }
  }, [selectedProject?.path, onFileChange, scheduleRefresh])

  if (isCollapsed || activeView !== "chat") {
    return null
  }

  const updateSecretField = (
    fieldKey: string,
    updater: (current: SecretFieldState) => SecretFieldState
  ) => {
    if (!selectedProjectId) {
      return
    }

    setSecretsByProject((current) => {
      const projectSecrets = current[selectedProjectId] ?? createInitialSecretsState()

      return {
        ...current,
        [selectedProjectId]: {
          ...projectSecrets,
          [fieldKey]: updater(projectSecrets[fieldKey] ?? {
            value: "",
            savedValue: "",
            isVisible: false,
          }),
        },
      }
    })
  }

  return (
    <aside className="w-[400px] max-w-[400px] min-w-48 shrink bg-sidebar text-sidebar-foreground border-l border-sidebar-border flex flex-col">
      {/* Header */}
      <div className="border-b border-sidebar-border px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl bg-sidebar-accent p-1">
            {(["files", "secrets"] as const).map((tab) => {
              const isActive = activeTab === tab

              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors cursor-pointer",
                    isActive
                      ? "bg-card text-card-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="overflow-y-auto px-2 py-2 flex-1">
        {activeTab === "files" ? (
          isInitialLoad ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-sm text-muted-foreground">Loading files...</span>
            </div>
          ) : !selectedProject ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-sm text-muted-foreground">Select an agent to view files</span>
            </div>
          ) : Object.keys(fileTreeData).length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-sm text-muted-foreground">No files found</span>
            </div>
          ) : (
            <FileTreeViewer
              data={fileTreeData}
              initialExpanded={["root"]}
              onFileClick={openFile}
            />
          )
        ) : (
          <div className="space-y-3 px-1 py-1">
            {!selectedProject ? (
              <div className="flex items-center justify-center py-8">
                <span className="text-sm text-muted-foreground">Select an agent to manage secrets</span>
              </div>
            ) : (
              <>
                {SECRET_FIELDS.map((field) => {
                  const state = selectedProjectSecrets[field.key]
                  const hasSavedValue = state.savedValue.trim().length > 0
                  const isDirty = state.value.trim() !== state.savedValue.trim()

                  return (
                    <div
                      key={field.key}
                      className="rounded-xl border border-border bg-card px-3 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{field.label}</p>
                        </div>
                        {hasSavedValue ? (
                          <button
                            type="button"
                            onClick={() =>
                              updateSecretField(field.key, (current) => ({
                                ...current,
                                isVisible: !current.isVisible,
                              }))
                            }
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                            aria-label={state.isVisible ? "Hide secret" : "Show secret"}
                          >
                            <Eye className="size-4" />
                          </button>
                        ) : null}
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <Input
                          type={hasSavedValue && !state.isVisible ? "password" : "text"}
                          value={state.value}
                          placeholder={field.placeholder}
                          onChange={(event) =>
                            updateSecretField(field.key, (current) => ({
                              ...current,
                              value: event.target.value,
                            }))
                          }
                        />
                        <Button
                          type="button"
                          disabled={state.value.trim().length === 0 || !isDirty}
                          onClick={() =>
                            updateSecretField(field.key, (current) => ({
                              ...current,
                              savedValue: current.value.trim(),
                              value: current.value.trim(),
                              isVisible: false,
                            }))
                          }
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        )}
      </div>

    </aside>
  )
}
