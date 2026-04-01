import { beforeEach, describe, expect, mock, test } from "bun:test"

const storeData = new Map<string, unknown>()

const desktopStore = {
  get: async <T>(key: string): Promise<T | null> =>
    storeData.has(key) ? (storeData.get(key) as T) : null,
  set: async (key: string, value: unknown) => {
    storeData.set(key, value)
  },
  delete: async (key: string) => {
    storeData.delete(key)
  },
  save: async () => {},
}

mock.module("@/desktop/client", () => ({
  desktop: {
    fs: {
      exists: async () => true,
      homeDir: async () => "/Users/tester",
    },
    git: {
      getBranches: async () => null,
      listWorktrees: async () => [],
      createWorktree: async () => ({ worktree: { branchName: "", path: "" } }),
      renameWorktree: async () => ({ worktree: { branchName: "", path: "" } }),
      removeWorktree: async () => ({ worktreePath: "" }),
      getChanges: async () => [],
    },
  },
  loadDesktopStore: async () => desktopStore,
}))

mock.module("@/features/workspace/store", () => ({
  useProjectStore: {
    getState: () => ({
      projects: [],
      isLoading: false,
      loadProjects: async () => {},
    }),
  },
}))

const { useChatStore } = await import("./chatStore")

function resetChatStore() {
  useChatStore.setState({
    chatByWorktree: {},
    messagesBySession: {},
    activePromptBySession: {},
    currentSessionId: null,
    childSessions: new Map(),
    workspaceSetupByWorktree: {},
    status: "idle",
    error: null,
    isLoading: false,
    isInitialized: true,
  })
}

describe("chatStore worktree scoping", () => {
  beforeEach(() => {
    storeData.clear()
    resetChatStore()
  })

  test("keeps chat sessions isolated per worktree", async () => {
    const firstSession = useChatStore.getState().createOptimisticSession("worktree-1", "/tmp/worktree-1")
    expect(firstSession).not.toBeNull()

    await useChatStore.getState().loadSessionsForProject("worktree-2", "/tmp/worktree-2")

    const firstWorktreeChat = useChatStore.getState().getProjectChat("worktree-1")
    const secondWorktreeChat = useChatStore.getState().getProjectChat("worktree-2")

    expect(firstWorktreeChat.sessions.map((session) => session.id)).toEqual([firstSession?.id])
    expect(secondWorktreeChat.sessions).toEqual([])
    expect(secondWorktreeChat.activeSessionId).toBeNull()
    expect(secondWorktreeChat.worktreePath).toBe("/tmp/worktree-2")
  })

  test("removes only the deleted worktree chat bucket", async () => {
    const firstSession = useChatStore.getState().createOptimisticSession("worktree-1", "/tmp/worktree-1")
    const secondSession = useChatStore.getState().createOptimisticSession("worktree-2", "/tmp/worktree-2")

    expect(firstSession).not.toBeNull()
    expect(secondSession).not.toBeNull()

    await useChatStore.getState().removeWorktreeData("worktree-1")

    expect(useChatStore.getState().chatByWorktree["worktree-1"]).toBeUndefined()
    expect(useChatStore.getState().chatByWorktree["worktree-2"]?.sessions.map((session) => session.id)).toEqual([
      secondSession?.id,
    ])
  })
})
