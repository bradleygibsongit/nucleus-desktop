import {
  createOptimisticRuntimeSession,
  deriveSessionTitle,
  replaceSession,
  touchSession,
} from "../domain/runtimeSessions"
import type { RuntimeSession } from "../types"
import type { ProjectChatState } from "./storeTypes"
import { DEFAULT_HARNESS_ID } from "../runtime/harnesses"

export function createDefaultProjectChat(projectPath?: string): ProjectChatState {
  return {
    sessions: [],
    activeSessionId: null,
    projectPath,
    archivedSessionIds: [],
    selectedHarnessId: DEFAULT_HARNESS_ID,
  }
}

export function sortSessions(sessions: RuntimeSession[]): RuntimeSession[] {
  return [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)
}

export function findProjectForSession(
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

export { createOptimisticRuntimeSession, deriveSessionTitle, replaceSession, touchSession }
