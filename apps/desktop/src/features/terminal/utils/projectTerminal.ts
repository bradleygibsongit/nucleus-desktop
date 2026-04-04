import {
  desktop,
  type TerminalCreateSessionEnvironment,
  type TerminalStartResponse,
} from "@/desktop/client"
import { useTabStore } from "@/features/editor/store"
import { getTerminalSessionId } from "./terminalTabs"

const PROJECT_TERMINAL_COLS = 120
const PROJECT_TERMINAL_ROWS = 32

interface RunCommandInProjectTerminalOptions {
  projectId: string
  cwd: string
  command: string
  environment?: TerminalCreateSessionEnvironment
}

interface ProjectTerminalStoreState {
  getOrCreateActiveTerminalTabId: (worktreeId: string) => string
  selectTerminalTab: (worktreeId: string, tabId: string) => void
}

interface ProjectTerminalClient {
  createSession: (
    sessionId: string,
    cwd: string,
    cols: number,
    rows: number,
    initialCommand?: string,
    environment?: TerminalCreateSessionEnvironment
  ) => Promise<TerminalStartResponse>
  write: (sessionId: string, data: string) => Promise<unknown>
}

interface RunCommandInProjectTerminalDependencies {
  terminalStore?: ProjectTerminalStoreState
  terminalClient?: ProjectTerminalClient
}

function escapePosixValue(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`
}

function escapePowershellValue(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function escapeCmdValue(value: string): string {
  return value.replace(/"/g, '""')
}

function buildEnvironmentPrefix(
  environment: TerminalCreateSessionEnvironment | undefined,
  shellKind: TerminalStartResponse["shellKind"],
): string[] {
  if (!environment) {
    return []
  }

  const entries = Object.entries(environment).filter(([, value]) => value.length > 0)
  if (entries.length === 0) {
    return []
  }

  return entries.map(([key, value]) => {
    if (shellKind === "powershell") {
      return `$env:${key}=${escapePowershellValue(value)}`
    }

    if (shellKind === "cmd") {
      return `set "${key}=${escapeCmdValue(value)}"`
    }

    return `export ${key}=${escapePosixValue(value)}`
  })
}

function buildChangeDirectoryCommand(
  cwd: string,
  shellKind: TerminalStartResponse["shellKind"],
): string {
  if (shellKind === "powershell") {
    return `Set-Location -LiteralPath ${escapePowershellValue(cwd)}`
  }

  if (shellKind === "cmd") {
    return `cd /d "${escapeCmdValue(cwd)}"`
  }

  return `cd -- ${escapePosixValue(cwd)}`
}

export async function runCommandInProjectTerminal(
  options: RunCommandInProjectTerminalOptions,
  dependencies: RunCommandInProjectTerminalDependencies = {},
) {
  const terminalStore = dependencies.terminalStore ?? useTabStore.getState()
  const terminalClient = dependencies.terminalClient ?? desktop.terminal
  const tabId = terminalStore.getOrCreateActiveTerminalTabId(options.projectId)

  terminalStore.selectTerminalTab(options.projectId, tabId)

  const sessionId = getTerminalSessionId(tabId)
  const commandToRun = options.command.trimEnd()

  const response = await terminalClient.createSession(
    sessionId,
    options.cwd,
    PROJECT_TERMINAL_COLS,
    PROJECT_TERMINAL_ROWS,
    undefined,
    options.environment,
  )

  const commandLines = [
    ...buildEnvironmentPrefix(options.environment, response.shellKind),
    buildChangeDirectoryCommand(options.cwd, response.shellKind),
    ...(commandToRun.length > 0 ? [commandToRun] : []),
  ]

  if (commandLines.length > 0) {
    await terminalClient.write(sessionId, `${commandLines.join("\n")}\n`)
  }

  return { tabId, sessionId }
}
