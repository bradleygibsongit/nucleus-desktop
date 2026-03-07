import { create } from "zustand"
import { nanoid } from "nanoid"
import { load, Store } from "@tauri-apps/plugin-store"
import {
  DEFAULT_HARNESS_ID,
  getHarnessAdapter,
  getHarnessDefinition,
  listHarnesses,
} from "../runtime/harnesses"
import type {
  ChatStatus,
  ChildSessionState,
  HarnessDefinition,
  HarnessId,
  MessageWithParts,
  RuntimeAgent,
  RuntimeCommand,
  RuntimeFileSearchResult,
  RuntimeSession,
} from "../types"

const STORE_FILE = "chat.json"

interface ProjectChatState {
  sessions: RuntimeSession[]
  activeSessionId: string | null
  projectPath?: string
  archivedSessionIds?: string[]
  selectedHarnessId: HarnessId
}

interface PersistedChatState {
  chatByProject: Record<string, ProjectChatState>
  messagesBySession: Record<string, MessageWithParts[]>
}

interface FileChangeEvent {
  file: string
  event: "add" | "change" | "unlink"
}

interface ChatState {
  chatByProject: Record<string, ProjectChatState>
  messagesBySession: Record<string, MessageWithParts[]>
  currentMessages: MessageWithParts[]
  currentSessionId: string | null
  childSessions: Map<string, ChildSessionState>
  status: ChatStatus | "connecting"
  error: string | null
  isLoading: boolean
  isInitialized: boolean
  harnesses: HarnessDefinition[]
  fileChangeListeners: Set<(event: FileChangeEvent) => void>
  initialize: () => Promise<void>
  getProjectChat: (projectId: string) => ProjectChatState
  getHarnessDefinition: (harnessId: HarnessId) => HarnessDefinition
  loadSessionsForProject: (projectId: string, projectPath: string) => Promise<void>
  openDraftSession: (projectId: string, projectPath: string) => Promise<void>
  createSession: (projectId: string, projectPath: string) => Promise<RuntimeSession | null>
  selectSession: (projectId: string, sessionId: string) => Promise<void>
  deleteSession: (projectId: string, sessionId: string) => Promise<void>
  archiveSession: (projectId: string, sessionId: string) => Promise<void>
  selectHarness: (projectId: string, harnessId: HarnessId) => Promise<void>
  listAgents: (projectId: string) => Promise<RuntimeAgent[]>
  listCommands: (projectId: string) => Promise<RuntimeCommand[]>
  searchFiles: (projectId: string, query: string, directory?: string) => Promise<RuntimeFileSearchResult[]>
  onFileChange: (listener: (event: FileChangeEvent) => void) => () => void
  sendMessage: (sessionId: string, text: string, agent?: string) => Promise<void>
  abortSession: (sessionId: string) => Promise<void>
  executeCommand: (sessionId: string, command: string, args?: string) => Promise<void>
  _persistState: () => Promise<void>
}

let storeInstance: Store | null = null

async function getStore(): Promise<Store> {
  if (!storeInstance) {
    storeInstance = await load(STORE_FILE)
  }
  return storeInstance
}

function createDefaultProjectChat(projectPath?: string): ProjectChatState {
  return {
    sessions: [],
    activeSessionId: null,
    projectPath,
    archivedSessionIds: [],
    selectedHarnessId: DEFAULT_HARNESS_ID,
  }
}

function createTextMessage(
  sessionId: string,
  role: "user" | "assistant",
  text: string
): MessageWithParts {
  const messageId = nanoid()

  return {
    info: {
      id: messageId,
      sessionId,
      role,
      createdAt: Date.now(),
      finishReason: role === "assistant" ? "end_turn" : undefined,
    },
    parts: [
      {
        id: nanoid(),
        type: "text",
        text,
      },
    ],
  }
}

function getSessionTitleFallback(session: RuntimeSession): string {
  if (session.title?.trim()) {
    return session.title
  }

  return `Session ${session.id.slice(0, 8)}`
}

function deriveSessionTitle(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim()
  if (!normalized) {
    return "New session"
  }

  return normalized.length > 48 ? `${normalized.slice(0, 45)}...` : normalized
}

function sortSessions(sessions: RuntimeSession[]): RuntimeSession[] {
  return [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)
}

function touchSession(session: RuntimeSession, title?: string): RuntimeSession {
  return {
    ...session,
    title: title ?? session.title,
    updatedAt: Date.now(),
  }
}

function findProjectForSession(
  chatByProject: Record<string, ProjectChatState>,
  sessionId: string
): { projectId: string; projectChat: ProjectChatState; session: RuntimeSession } | null {
  for (const [projectId, projectChat] of Object.entries(chatByProject)) {
    const session = projectChat.sessions.find((candidate) => candidate.id === sessionId)
    if (session) {
      return { projectId, projectChat, session }
    }
  }

  return null
}

function replaceSession(
  sessions: RuntimeSession[],
  nextSession: RuntimeSession
): RuntimeSession[] {
  return sortSessions(
    sessions.map((session) => (session.id === nextSession.id ? nextSession : session))
  )
}

function remapMessagesToSession(
  messages: MessageWithParts[],
  sessionId: string
): MessageWithParts[] {
  return messages.map((message) => ({
    ...message,
    info: {
      ...message.info,
      sessionId,
    },
    parts: message.parts.map((part) =>
      part.type === "tool"
        ? {
            ...part,
            sessionId,
          }
        : part
    ),
  }))
}

function shouldRecreateRemoteSession(session: RuntimeSession, error: unknown): boolean {
  if (session.harnessId !== "codex") {
    return false
  }

  const message = String(error)
  return message.includes("no rollout found for thread id")
}

function emitFileChanges(
  listeners: Set<(event: FileChangeEvent) => void>,
  messages: MessageWithParts[]
): void {
  if (listeners.size === 0) {
    return
  }

  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type !== "tool" || part.tool !== "fileChange") {
        continue
      }

      const output = part.state.output
      const changes =
        output && typeof output === "object" && "changes" in output
          ? (output as { changes?: unknown[] }).changes
          : undefined

      if (!Array.isArray(changes)) {
        continue
      }

      for (const change of changes) {
        if (!change || typeof change !== "object") {
          continue
        }

        const path =
          "path" in change && typeof change.path === "string"
            ? change.path
            : "newPath" in change && typeof change.newPath === "string"
              ? change.newPath
              : null

        if (!path) {
          continue
        }

        for (const listener of listeners) {
          listener({
            file: path,
            event: "change",
          })
        }
      }
    }
  }
}

export const useChatStore = create<ChatState>((set, get) => ({
  chatByProject: {},
  messagesBySession: {},
  currentMessages: [],
  currentSessionId: null,
  childSessions: new Map<string, ChildSessionState>(),
  status: "idle",
  error: null,
  isLoading: true,
  isInitialized: false,
  harnesses: listHarnesses(),
  fileChangeListeners: new Set(),

  initialize: async () => {
    if (get().isInitialized) {
      return
    }

    try {
      const store = await getStore()
      const persisted = await store.get<PersistedChatState>("chatState")

      set({
        chatByProject: persisted?.chatByProject ?? {},
        messagesBySession: persisted?.messagesBySession ?? {},
        isLoading: false,
        isInitialized: true,
      })

      const uniqueHarnessIds = new Set<HarnessId>()
      for (const projectChat of Object.values(persisted?.chatByProject ?? {})) {
        uniqueHarnessIds.add(projectChat.selectedHarnessId ?? DEFAULT_HARNESS_ID)
        for (const session of projectChat.sessions) {
          uniqueHarnessIds.add(session.harnessId ?? DEFAULT_HARNESS_ID)
        }
      }

      await Promise.all(
        Array.from(uniqueHarnessIds).map((harnessId) =>
          getHarnessAdapter(harnessId).initialize()
        )
      )
    } catch (error) {
      console.error("[chatStore] Failed to initialize:", error)
      set({
        isLoading: false,
        isInitialized: true,
        error: String(error),
      })
    }
  },

  getProjectChat: (projectId: string) => {
    const { chatByProject } = get()
    return chatByProject[projectId] ?? createDefaultProjectChat()
  },

  getHarnessDefinition: (harnessId: HarnessId) => getHarnessDefinition(harnessId),

  loadSessionsForProject: async (projectId: string, projectPath: string) => {
    const { chatByProject } = get()
    const projectChat = chatByProject[projectId] ?? createDefaultProjectChat(projectPath)

    set({
      chatByProject: {
        ...chatByProject,
        [projectId]: {
          ...projectChat,
          projectPath,
        },
      },
    })

    await get()._persistState()
  },

  openDraftSession: async (projectId: string, projectPath: string) => {
    const { chatByProject } = get()
    const projectChat = chatByProject[projectId] ?? createDefaultProjectChat(projectPath)

    set({
      chatByProject: {
        ...chatByProject,
        [projectId]: {
          ...projectChat,
          projectPath,
          activeSessionId: null,
        },
      },
      currentSessionId: null,
      currentMessages: [],
      childSessions: new Map<string, ChildSessionState>(),
      status: "idle",
      error: null,
    })

    await get()._persistState()
  },

  createSession: async (projectId: string, projectPath: string) => {
    const { chatByProject } = get()
    const projectChat = chatByProject[projectId] ?? createDefaultProjectChat(projectPath)
    const adapter = getHarnessAdapter(projectChat.selectedHarnessId)
    const session = await adapter.createSession(projectPath)

    set({
      chatByProject: {
        ...chatByProject,
        [projectId]: {
          ...projectChat,
          projectPath,
          sessions: sortSessions([session, ...projectChat.sessions]),
          activeSessionId: session.id,
        },
      },
      currentSessionId: session.id,
      currentMessages: [],
      childSessions: new Map<string, ChildSessionState>(),
      status: "idle",
      error: null,
    })

    await get()._persistState()
    return session
  },

  selectSession: async (projectId: string, sessionId: string) => {
    const { chatByProject, messagesBySession } = get()
    const projectChat = chatByProject[projectId]
    if (!projectChat) {
      return
    }

    set({
      chatByProject: {
        ...chatByProject,
        [projectId]: {
          ...projectChat,
          activeSessionId: sessionId,
        },
      },
      currentSessionId: sessionId,
      currentMessages: messagesBySession[sessionId] ?? [],
      childSessions: new Map<string, ChildSessionState>(),
      status: "idle",
      error: null,
    })

    await get()._persistState()
  },

  deleteSession: async (projectId: string, sessionId: string) => {
    const { chatByProject, messagesBySession, currentSessionId } = get()
    const projectChat = chatByProject[projectId]
    if (!projectChat) {
      return
    }

    const updatedSessions = projectChat.sessions.filter((session) => session.id !== sessionId)
    const nextMessages = { ...messagesBySession }
    delete nextMessages[sessionId]

    const wasActive = projectChat.activeSessionId === sessionId
    const nextActiveSessionId = wasActive ? updatedSessions[0]?.id ?? null : projectChat.activeSessionId

    set({
      chatByProject: {
        ...chatByProject,
        [projectId]: {
          ...projectChat,
          sessions: updatedSessions,
          activeSessionId: nextActiveSessionId,
        },
      },
      messagesBySession: nextMessages,
      currentSessionId: currentSessionId === sessionId ? nextActiveSessionId : currentSessionId,
      currentMessages:
        currentSessionId === sessionId && nextActiveSessionId
          ? nextMessages[nextActiveSessionId] ?? []
          : currentSessionId === sessionId
            ? []
            : get().currentMessages,
    })

    await get()._persistState()
  },

  archiveSession: async (projectId: string, sessionId: string) => {
    const { chatByProject, currentSessionId } = get()
    const projectChat = chatByProject[projectId]
    if (!projectChat) {
      return
    }

    const archivedSessionIds = new Set(projectChat.archivedSessionIds ?? [])
    archivedSessionIds.add(sessionId)

    const remainingSessions = projectChat.sessions.filter(
      (session) => !archivedSessionIds.has(session.id)
    )
    const nextActiveSessionId =
      projectChat.activeSessionId === sessionId
        ? remainingSessions[0]?.id ?? null
        : projectChat.activeSessionId

    set({
      chatByProject: {
        ...chatByProject,
        [projectId]: {
          ...projectChat,
          archivedSessionIds: Array.from(archivedSessionIds),
          activeSessionId: nextActiveSessionId,
        },
      },
      currentSessionId: currentSessionId === sessionId ? nextActiveSessionId : currentSessionId,
      currentMessages:
        currentSessionId === sessionId && nextActiveSessionId
          ? get().messagesBySession[nextActiveSessionId] ?? []
          : currentSessionId === sessionId
            ? []
            : get().currentMessages,
    })

    await get()._persistState()
  },

  selectHarness: async (projectId: string, harnessId: HarnessId) => {
    const { chatByProject } = get()
    const projectChat = chatByProject[projectId] ?? createDefaultProjectChat()

    set({
      chatByProject: {
        ...chatByProject,
        [projectId]: {
          ...projectChat,
          selectedHarnessId: harnessId,
        },
      },
    })

    await getHarnessAdapter(harnessId).initialize()
    await get()._persistState()
  },

  listAgents: async (projectId: string) => {
    const projectChat = get().getProjectChat(projectId)
    const adapter = getHarnessAdapter(projectChat.selectedHarnessId)
    return adapter.listAgents()
  },

  listCommands: async (projectId: string) => {
    const projectChat = get().getProjectChat(projectId)
    const adapter = getHarnessAdapter(projectChat.selectedHarnessId)
    return adapter.listCommands()
  },

  searchFiles: async (projectId: string, query: string, directory?: string) => {
    const projectChat = get().getProjectChat(projectId)
    const adapter = getHarnessAdapter(projectChat.selectedHarnessId)
    return adapter.searchFiles(query, directory)
  },

  onFileChange: (listener) => {
    const listeners = get().fileChangeListeners
    listeners.add(listener)

    return () => {
      listeners.delete(listener)
    }
  },

  sendMessage: async (sessionId: string, text: string, agent?: string) => {
    if (!text.trim()) {
      return
    }

    const sessionMatch = findProjectForSession(get().chatByProject, sessionId)
    if (!sessionMatch) {
      return
    }

    const { projectId, projectChat, session } = sessionMatch
    const adapter = getHarnessAdapter(session.harnessId)
    const userMessage = createTextMessage(sessionId, "user", text.trim())
    const nextSessionTitle = session.title ?? deriveSessionTitle(text)
    const nextSession = touchSession(session, nextSessionTitle)
    const nextMessages = [...(get().messagesBySession[sessionId] ?? []), userMessage]

    set({
      chatByProject: {
        ...get().chatByProject,
        [projectId]: {
          ...projectChat,
          sessions: replaceSession(projectChat.sessions, nextSession),
          activeSessionId: sessionId,
        },
      },
      messagesBySession: {
        ...get().messagesBySession,
        [sessionId]: nextMessages,
      },
      currentSessionId: sessionId,
      currentMessages: nextMessages,
      childSessions: new Map<string, ChildSessionState>(),
      status: "streaming",
      error: null,
    })

    try {
      const result = await adapter.sendMessage({
        session: nextSession,
        projectPath: projectChat.projectPath,
        text: text.trim(),
        agent,
      })

      const sessionMessages = [
        ...(get().messagesBySession[sessionId] ?? nextMessages),
        ...(result.messages ?? []),
      ]

      set({
        messagesBySession: {
          ...get().messagesBySession,
          [sessionId]: sessionMessages,
        },
        currentMessages: get().currentSessionId === sessionId ? sessionMessages : get().currentMessages,
        childSessions: new Map(
          (result.childSessions ?? []).map((childState) => [childState.session.id, childState])
        ),
        status: "idle",
      })

      emitFileChanges(get().fileChangeListeners, result.messages ?? [])
    } catch (error) {
      if (shouldRecreateRemoteSession(session, error)) {
        try {
          const recreatedSession = await adapter.createSession(
            projectChat.projectPath ?? session.projectPath ?? ""
          )
          const migratedSession: RuntimeSession = {
            ...recreatedSession,
            title: nextSession.title ?? recreatedSession.title,
            projectPath: projectChat.projectPath ?? recreatedSession.projectPath,
          }
          const migratedMessages = remapMessagesToSession(nextMessages, migratedSession.id)
          const migratedProjectChat: ProjectChatState = {
            ...projectChat,
            sessions: sortSessions([
              migratedSession,
              ...projectChat.sessions.filter((candidate) => candidate.id !== session.id),
            ]),
            activeSessionId: migratedSession.id,
          }

          set({
            chatByProject: {
              ...get().chatByProject,
              [projectId]: migratedProjectChat,
            },
            messagesBySession: {
              ...Object.fromEntries(
                Object.entries(get().messagesBySession).filter(([key]) => key !== session.id)
              ),
              [migratedSession.id]: migratedMessages,
            },
            currentSessionId: migratedSession.id,
            currentMessages: migratedMessages,
            status: "streaming",
            error: null,
          })

          const retriedResult = await adapter.sendMessage({
            session: migratedSession,
            projectPath: migratedProjectChat.projectPath,
            text: text.trim(),
            agent,
          })

          const retriedMessages = [
            ...(get().messagesBySession[migratedSession.id] ?? migratedMessages),
            ...(retriedResult.messages ?? []),
          ]

          set({
            messagesBySession: {
              ...get().messagesBySession,
              [migratedSession.id]: retriedMessages,
            },
            currentMessages:
              get().currentSessionId === migratedSession.id
                ? retriedMessages
                : get().currentMessages,
            childSessions: new Map(
              (retriedResult.childSessions ?? []).map((childState) => [
                childState.session.id,
                childState,
              ])
            ),
            status: "idle",
          })

          emitFileChanges(get().fileChangeListeners, retriedResult.messages ?? [])
          await get()._persistState()
          return
        } catch (retryError) {
          error = retryError
        }
      }

      const failureMessage = createTextMessage(
        sessionId,
        "assistant",
        `Failed to send this turn to ${adapter.definition.label}: ${String(error)}`
      )
      const sessionMessages = [...(get().messagesBySession[sessionId] ?? nextMessages), failureMessage]

      set({
        messagesBySession: {
          ...get().messagesBySession,
          [sessionId]: sessionMessages,
        },
        currentMessages: get().currentSessionId === sessionId ? sessionMessages : get().currentMessages,
        status: "error",
        error: String(error),
      })
    }

    await get()._persistState()
  },

  abortSession: async (sessionId: string) => {
    const sessionMatch = findProjectForSession(get().chatByProject, sessionId)
    if (!sessionMatch) {
      return
    }

    await getHarnessAdapter(sessionMatch.session.harnessId).abortSession(sessionMatch.session)
    set({ status: "idle" })
  },

  executeCommand: async (sessionId: string, command: string, args: string = "") => {
    const sessionMatch = findProjectForSession(get().chatByProject, sessionId)
    if (!sessionMatch) {
      return
    }

    const { projectId, projectChat, session } = sessionMatch
    const adapter = getHarnessAdapter(session.harnessId)
    const nextSession = touchSession(session)

    set({
      chatByProject: {
        ...get().chatByProject,
        [projectId]: {
          ...projectChat,
          sessions: replaceSession(projectChat.sessions, nextSession),
          activeSessionId: sessionId,
        },
      },
      status: "streaming",
      error: null,
    })

    try {
      const result = await adapter.executeCommand({
        session: nextSession,
        projectPath: projectChat.projectPath,
        command,
        args,
      })

      const sessionMessages = [
        ...(get().messagesBySession[sessionId] ?? []),
        ...(result.messages ?? []),
      ]

      set({
        messagesBySession: {
          ...get().messagesBySession,
          [sessionId]: sessionMessages,
        },
        currentMessages: get().currentSessionId === sessionId ? sessionMessages : get().currentMessages,
        status: "idle",
      })
    } catch (error) {
      set({
        status: "error",
        error: String(error),
      })
    }

    await get()._persistState()
  },

  _persistState: async () => {
    const { chatByProject, messagesBySession } = get()
    const store = await getStore()
    await store.set("chatState", {
      chatByProject,
      messagesBySession,
    } satisfies PersistedChatState)
    await store.save()
  },
}))

export type { MessageWithParts, ChildSessionState, RuntimeSession as Session } from "../types"
