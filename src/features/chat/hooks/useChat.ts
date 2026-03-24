import { useState, useCallback, useEffect } from "react"
import { useProjectStore } from "@/features/workspace/store"
import { useChatStore, type MessageWithParts } from "../store"
import { hasProjectChatSession } from "../store/sessionState"
import type { ChatStatus, CollaborationModeKind, HarnessId, RuntimePromptState, Session } from "../types"

/**
 * Chat hook connected to the harness-neutral runtime store.
 * Automatically syncs with the selected project.
 */
export function useChat() {
  const [draftInputsBySessionKey, setDraftInputsBySessionKey] = useState<Record<string, string>>({})

  // Project state
  const { projects, selectedProjectId } = useProjectStore()
  const selectedProject = projects.find((p) => p.id === selectedProjectId)

  // Chat store state
  const {
    currentMessages,
    currentSessionId,
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
    createOptimisticSession,
    selectSession,
    deleteSession,
    selectHarness,
    activePromptBySession,
    answerPrompt,
    dismissPrompt,
    sendMessage,
    abortSession,
    executeCommand,
  } = useChatStore()

  // Get current project's chat state
  const projectChat = selectedProjectId ? getProjectChat(selectedProjectId) : null
  const activeSessionId =
    projectChat && hasProjectChatSession(projectChat, projectChat.activeSessionId)
      ? projectChat.activeSessionId
      : null
  const sessions = projectChat?.sessions ?? []
  const selectedHarnessId = projectChat?.selectedHarnessId ?? null
  const selectedHarness = selectedHarnessId ? getHarnessDefinition(selectedHarnessId) : null
  const draftSessionKey = activeSessionId ?? (selectedProjectId ? `draft:${selectedProjectId}` : "draft:no-project")
  const input = draftInputsBySessionKey[draftSessionKey] ?? ""
  const activePromptState: RuntimePromptState | null =
    activeSessionId ? activePromptBySession[activeSessionId] ?? null : null
  const activePrompt = activePromptState?.status === "active" ? activePromptState.prompt : null

  const setInput = useCallback(
    (value: string) => {
      setDraftInputsBySessionKey((current) => ({
        ...current,
        [draftSessionKey]: value,
      }))
    },
    [draftSessionKey]
  )

  const clearDraftInput = useCallback(
    (sessionKey: string) => {
      setDraftInputsBySessionKey((current) => {
        if (!(sessionKey in current)) {
          return current
        }

        const nextDrafts = { ...current }
        delete nextDrafts[sessionKey]
        return nextDrafts
      })
    },
    []
  )

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
    async (
      text: string,
      sessionIdOverride?: string,
      options?: {
        agent?: string
        collaborationMode?: CollaborationModeKind
        model?: string
        reasoningEffort?: string | null
      }
    ) => {
      const targetSessionId = sessionIdOverride ?? activeSessionId
      
      if (!text.trim() || status === "streaming" || !targetSessionId) {
        return
      }

      clearDraftInput(targetSessionId)
      await sendMessage(targetSessionId, text, options)
    },
    [status, activeSessionId, clearDraftInput, sendMessage]
  )

  // Handle creating a new session
  const handleCreateSession = useCallback(async () => {
    if (!selectedProjectId || !selectedProject?.path) return null
    return createSession(selectedProjectId, selectedProject.path)
  }, [selectedProjectId, selectedProject?.path, createSession])

  const handleCreateOptimisticSession = useCallback(() => {
    if (!selectedProjectId || !selectedProject?.path) return null
    return createOptimisticSession(selectedProjectId, selectedProject.path)
  }, [selectedProjectId, selectedProject?.path, createOptimisticSession])

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

  const handleAnswerPrompt = useCallback(
    async (response: Parameters<typeof answerPrompt>[1]) => {
      if (!activeSessionId) {
        return
      }

      await answerPrompt(activeSessionId, response)
    },
    [activeSessionId, answerPrompt]
  )

  const handleDismissPrompt = useCallback(async () => {
    if (!activeSessionId) {
      return
    }

    await dismissPrompt(activeSessionId)
  }, [activeSessionId, dismissPrompt])

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
  const isResolvedActiveSession = activeSessionId != null && currentSessionId === activeSessionId
  const uiStatus: ChatStatus = status === "connecting" ? "idle" : status

  return {
    // Message state
    messages: isResolvedActiveSession ? currentMessages : [],
    childSessions: isResolvedActiveSession ? childSessions : new Map(),
    status: isResolvedActiveSession ? uiStatus : "idle",
    input,
    setInput,
    handleSubmit,
    activePrompt,
    answerPrompt: handleAnswerPrompt,
    dismissPrompt: handleDismissPrompt,

    // Session state
    sessions,
    activeSessionId,
    activeSession: sessions.find((s) => s.id === activeSessionId) ?? null,
    harnesses,
    selectedHarnessId,
    selectedHarness,

    // Session actions
    createSession: handleCreateSession,
    createOptimisticSession: handleCreateOptimisticSession,
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
