import { useState, useCallback, useEffect } from "react"
import { useProjectStore } from "@/features/workspace/store"
import { useChatStore, type MessageWithParts } from "../store"
import type { ChatStatus, HarnessId, Session } from "../types"

/**
 * Chat hook connected to the harness-neutral runtime store.
 * Automatically syncs with the selected project.
 */
export function useChat() {
  const [input, setInput] = useState("")

  // Project state
  const { projects, selectedProjectId } = useProjectStore()
  const selectedProject = projects.find((p) => p.id === selectedProjectId)

  // Chat store state
  const {
    currentMessages,
    childSessions,
    status,
    error,
    isLoading,
    isInitialized,
    harnesses,
    initialize,
    getProjectChat,
    getHarnessDefinition,
    loadSessionsForProject,
    createSession,
    selectSession,
    deleteSession,
    selectHarness,
    sendMessage,
    abortSession,
    executeCommand,
  } = useChatStore()

  // Get current project's chat state
  const projectChat = selectedProjectId ? getProjectChat(selectedProjectId) : null
  const activeSessionId = projectChat?.activeSessionId ?? null
  const sessions = projectChat?.sessions ?? []
  const selectedHarnessId = projectChat?.selectedHarnessId ?? null
  const selectedHarness = selectedHarnessId ? getHarnessDefinition(selectedHarnessId) : null

  // Initialize chat store on mount
  useEffect(() => {
    initialize()
  }, [initialize])

  // Load sessions when project changes
  useEffect(() => {
    if (selectedProjectId && selectedProject?.path && isInitialized) {
      loadSessionsForProject(selectedProjectId, selectedProject.path)
    }
  }, [selectedProjectId, selectedProject?.path, isInitialized, loadSessionsForProject])

  // Handle message submission
  const handleSubmit = useCallback(
    async (text: string, sessionIdOverride?: string, agent?: string) => {
      const targetSessionId = sessionIdOverride ?? activeSessionId
      
      if (!text.trim() || status === "streaming" || !targetSessionId) {
        return
      }

      setInput("")
      await sendMessage(targetSessionId, text, agent)
    },
    [status, activeSessionId, sendMessage]
  )

  // Handle creating a new session
  const handleCreateSession = useCallback(async () => {
    if (!selectedProjectId || !selectedProject?.path) return null
    return createSession(selectedProjectId, selectedProject.path)
  }, [selectedProjectId, selectedProject?.path, createSession])

  // Handle selecting a session
  const handleSelectSession = useCallback(
    async (sessionId: string) => {
      if (!selectedProjectId) return
      await selectSession(selectedProjectId, sessionId)
    },
    [selectedProjectId, selectSession]
  )

  // Handle deleting a session
  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      if (!selectedProjectId) return
      await deleteSession(selectedProjectId, sessionId)
    },
    [selectedProjectId, deleteSession]
  )

  const handleSelectHarness = useCallback(
    async (harnessId: HarnessId) => {
      if (!selectedProjectId) return
      await selectHarness(selectedProjectId, harnessId)
    },
    [selectedProjectId, selectHarness]
  )

  // Handle abort
  const handleAbort = useCallback(async () => {
    if (!activeSessionId) return
    await abortSession(activeSessionId)
  }, [activeSessionId, abortSession])

  // Handle command execution
  const handleExecuteCommand = useCallback(
    async (command: string, args?: string, sessionIdOverride?: string) => {
      const targetSessionId = sessionIdOverride ?? activeSessionId
      if (!targetSessionId) {
        console.error("[useChat] No session ID for command execution")
        return
      }
      await executeCommand(targetSessionId, command, args)
    },
    [activeSessionId, executeCommand]
  )

  // Convert SDK messages to UI format
  const uiStatus: ChatStatus = status === "connecting" ? "idle" : status

  return {
    // Message state
    messages: currentMessages,
    childSessions,
    status: uiStatus,
    input,
    setInput,
    handleSubmit,

    // Session state
    sessions,
    activeSessionId,
    activeSession: sessions.find((s) => s.id === activeSessionId) ?? null,
    harnesses,
    selectedHarnessId,
    selectedHarness,

    // Session actions
    createSession: handleCreateSession,
    selectSession: handleSelectSession,
    deleteSession: handleDeleteSession,
    selectHarness: handleSelectHarness,
    abort: handleAbort,
    executeCommand: handleExecuteCommand,

    // Project context
    selectedProject,

    // Connection state
    isConnected: isInitialized && !!selectedHarness,
    isConnecting: status === "connecting",
    isLoading,
    error,
  }
}

export type { MessageWithParts, Session }
