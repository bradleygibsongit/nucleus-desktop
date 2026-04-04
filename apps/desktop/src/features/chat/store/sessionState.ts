import {
  createOptimisticRuntimeSession,
  deriveSessionTitle,
  replaceSession,
  touchSession,
} from "../domain/runtimeSessions"
import type { RuntimeSession } from "../types"
import type { ProjectChatState } from "./storeTypes"
import { DEFAULT_HARNESS_ID } from "../runtime/harnesses"

export function createDefaultProjectChat(worktreePath?: string): ProjectChatState {
  return {
    sessions: [],
    activeSessionId: null,
    worktreePath,
    archivedSessionIds: [],
    selectedHarnessId: DEFAULT_HARNESS_ID,
  }
}

export function sortSessions(sessions: RuntimeSession[]): RuntimeSession[] {
  return [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)
}

export function hasProjectChatSession(
  projectChat: ProjectChatState,
  sessionId: string | null | undefined
): sessionId is string {
  if (!sessionId) {
    return false
  }

  const archivedSessionIds = new Set(projectChat.archivedSessionIds ?? [])
  return (
    !archivedSessionIds.has(sessionId) &&
    projectChat.sessions.some((candidate) => candidate.id === sessionId)
  )
}

export function normalizeProjectChat(projectChat: ProjectChatState): ProjectChatState {
  const archivedSessionIds = Array.from(new Set(projectChat.archivedSessionIds ?? []))

  return {
    ...projectChat,
    archivedSessionIds,
    activeSessionId: hasProjectChatSession(projectChat, projectChat.activeSessionId)
      ? projectChat.activeSessionId
      : null,
    selectedHarnessId: projectChat.selectedHarnessId ?? DEFAULT_HARNESS_ID,
  }
}

export function findProjectForSession(
  chatByWorktree: Record<string, ProjectChatState>,
  sessionId: string
): { worktreeId: string; projectChat: ProjectChatState; session: RuntimeSession } | null {
  for (const [worktreeId, projectChat] of Object.entries(chatByWorktree)) {
    if (!hasProjectChatSession(projectChat, sessionId)) {
      continue
    }

    const session = projectChat.sessions.find((candidate) => candidate.id === sessionId)
    if (session) {
      return { worktreeId, projectChat, session }
    }
  }

  return null
}

export { createOptimisticRuntimeSession, deriveSessionTitle, replaceSession, touchSession }
