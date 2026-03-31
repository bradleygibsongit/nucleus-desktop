import { beforeEach, describe, expect, mock, test } from "bun:test"

import { useTerminalStore } from "@/features/terminal/store/terminalStore"
import { runCommandInProjectTerminal } from "./projectTerminal"

describe("runCommandInProjectTerminal", () => {
  beforeEach(() => {
    useTerminalStore.setState({ terminalStateByProject: {} })
  })

  test("reuses the active tab, expands the terminal, and writes the command once", async () => {
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

    const projectTerminalState = useTerminalStore.getState().terminalStateByProject["worktree-1"]

    expect(projectTerminalState.activeTabId).toBe(result.tabId)
    expect(projectTerminalState.isCollapsed).toBe(false)
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
      "export NUCLEUS_WORKSPACE_PATH='/tmp/repo/worktree-1'\necho ready\n",
    )
  })
})
