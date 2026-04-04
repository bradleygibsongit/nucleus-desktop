import { beforeEach, describe, expect, mock, test } from "bun:test"

import { useTabStore } from "@/features/editor/store"
import { runCommandInProjectTerminal } from "./projectTerminal"
import { isTerminalTab } from "./terminalTabs"

describe("runCommandInProjectTerminal", () => {
  beforeEach(() => {
    useTabStore.setState({
      currentWorktreeId: "worktree-1",
      tabsByWorktree: {},
      tabs: [],
      activeTabId: null,
      activeTerminalTabId: null,
      isInitialized: false,
    })
  })

  test("reuses the active terminal tab, activates it, and writes the command once", async () => {
    const createSession = mock(async () => ({ initialData: "", shellKind: "posix" as const }))
    const write = mock(async () => {})
    const environment = {
      NUCLEUS_WORKSPACE_PATH: "/tmp/repo/worktree-1",
    }

    const result = await runCommandInProjectTerminal(
      {
        projectId: "worktree-1",
        cwd: "/tmp/repo/worktree-1",
        command: "echo ready   ",
        environment,
      },
      {
        terminalClient: {
          createSession,
          write,
        },
      },
    )

    const terminalTabs = useTabStore.getState().tabs.filter(isTerminalTab)
    const [terminalTab] = terminalTabs

    expect(terminalTabs).toHaveLength(1)
    expect(terminalTab?.id).toBe(result.tabId)
    expect(useTabStore.getState().activeTabId).toBe(result.tabId)
    expect(useTabStore.getState().activeTerminalTabId).toBe(result.tabId)
    expect(createSession).toHaveBeenCalledTimes(1)
    expect(createSession).toHaveBeenCalledWith(
      result.sessionId,
      "/tmp/repo/worktree-1",
      120,
      32,
      undefined,
      environment,
    )
    expect(write).toHaveBeenCalledTimes(1)
    expect(write).toHaveBeenCalledWith(
      result.sessionId,
      "export NUCLEUS_WORKSPACE_PATH='/tmp/repo/worktree-1'\ncd -- '/tmp/repo/worktree-1'\necho ready\n",
    )
  })

  test("persists a synthesized terminal tab before activating a background worktree terminal", async () => {
    useTabStore.setState({
      currentWorktreeId: "worktree-1",
      tabsByWorktree: {},
      tabs: [],
      activeTabId: null,
      activeTerminalTabId: null,
      isInitialized: false,
    })

    const createSession = mock(async () => ({ initialData: "", shellKind: "posix" as const }))
    const write = mock(async () => {})

    const result = await runCommandInProjectTerminal(
      {
        projectId: "worktree-2",
        cwd: "/tmp/repo/worktree-2",
        command: "pwd",
      },
      {
        terminalClient: {
          createSession,
          write,
        },
      },
    )

    const worktreeTabs = useTabStore.getState().tabsByWorktree["worktree-2"]
    const terminalTabs = worktreeTabs?.tabs.filter(isTerminalTab) ?? []

    expect(terminalTabs).toHaveLength(1)
    expect(terminalTabs[0]?.id).toBe(result.tabId)
    expect(worktreeTabs?.activeTabId).toBe(result.tabId)
    expect(worktreeTabs?.activeTerminalTabId).toBe(result.tabId)
    expect(createSession).toHaveBeenCalledWith(
      result.sessionId,
      "/tmp/repo/worktree-2",
      120,
      32,
      undefined,
      undefined,
    )
    expect(write).toHaveBeenCalledWith(result.sessionId, "cd -- '/tmp/repo/worktree-2'\npwd\n")
  })
})
