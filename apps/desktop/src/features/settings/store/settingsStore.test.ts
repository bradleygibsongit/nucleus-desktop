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

const { useSettingsStore } = await import("./settingsStore")

function resetSettingsStore() {
  useSettingsStore.setState({
    gitGenerationModel: "",
    gitResolvePrompts: {
      conflicts: "conflicts",
      behind: "behind",
      failed_checks: "failed_checks",
      blocked: "blocked",
      draft: "draft",
      unknown: "unknown",
    },
    workspaceSetupModel: "",
    hasLoaded: false,
  })
}

describe("settingsStore resolve prompts", () => {
  beforeEach(() => {
    storeData.clear()
    resetSettingsStore()
  })

  test("initializes missing resolve prompts with defaults while keeping saved values", async () => {
    storeData.set("gitResolvePrompts", {
      conflicts: "Resolve {{currentBranch}}",
    })

    await useSettingsStore.getState().initialize()

    expect(useSettingsStore.getState().gitResolvePrompts.conflicts).toBe("Resolve {{currentBranch}}")
    expect(useSettingsStore.getState().gitResolvePrompts.behind.length).toBeGreaterThan(0)
    expect(useSettingsStore.getState().gitResolvePrompts.failed_checks.length).toBeGreaterThan(0)
  })

  test("persists edited resolve prompts", async () => {
    await useSettingsStore.getState().initialize()
    useSettingsStore.getState().setGitResolvePrompt("blocked", "Inspect {{prUrl}}")

    await Bun.sleep(350)

    expect(storeData.get("gitResolvePrompts")).toMatchObject({
      blocked: "Inspect {{prUrl}}",
    })
  })
})
