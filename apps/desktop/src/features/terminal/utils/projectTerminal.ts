import {
  desktop,
  type TerminalCreateSessionEnvironment,
  type TerminalStartResponse,
} from "@/desktop/client"
import { useTerminalStore } from "@/features/terminal/store/terminalStore"

const PROJECT_TERMINAL_COLS = 120
const PROJECT_TERMINAL_ROWS = 32

interface RunCommandInProjectTerminalOptions {
  projectId: string
  cwd: string
  command: string
  environment?: TerminalCreateSessionEnvironment
}

interface ProjectTerminalStoreState {
  getOrCreateActiveTabId: (projectId: string) => string
  selectTerminal: (projectId: string, tabId: string) => void
  setProjectCollapsed: (projectId: string, isCollapsed: boolean) => void
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

export async function runCommandInProjectTerminal(
  options: RunCommandInProjectTerminalOptions,
  dependencies: RunCommandInProjectTerminalDependencies = {},
) {
  const terminalStore = dependencies.terminalStore ?? useTerminalStore.getState()
  const terminalClient = dependencies.terminalClient ?? desktop.terminal
  const tabId = terminalStore.getOrCreateActiveTabId(options.projectId)

  terminalStore.selectTerminal(options.projectId, tabId)
  terminalStore.setProjectCollapsed(options.projectId, false)

  const sessionId = `project-terminal:${tabId}`
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
    ...(commandToRun.length > 0 ? [commandToRun] : []),
  ]

  if (commandLines.length > 0) {
    await terminalClient.write(sessionId, `${commandLines.join("\n")}\n`)
  }

  return { tabId, sessionId }
}
