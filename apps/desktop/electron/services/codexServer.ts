import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import readline from "node:readline"
import { EVENT_CHANNELS } from "../ipc/channels"
import { capture, captureException } from "./analytics"
import type { ProviderSettingsService } from "./runtime/providerSettings"
import { resolveProviderCommand } from "./runtime/providerSettings"

type EventSender = (channel: string, payload: unknown) => void

export interface CodexServerDiagnostic {
  kind: "mcp-auth"
  severity: "warning"
  message: string
  rawMessage: string
}

export async function resolveCodexLaunchConfig(): Promise<{
  command: string
  env: NodeJS.ProcessEnv
}> {
  return resolveProviderCommand({
    binaryPath: process.env.VFACTOR_CODEX_PATH?.trim() || "codex",
    executableName: process.platform === "win32" ? "codex.exe" : "codex",
  })
}

function waitForSpawn(child: ChildProcessWithoutNullStreams): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false

    const cleanup = () => {
      child.removeListener("spawn", handleSpawn)
      child.removeListener("error", handleError)
    }

    const handleSpawn = () => {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      resolve()
    }

    const handleError = (error: Error) => {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      reject(error)
    }

    child.once("spawn", handleSpawn)
    child.once("error", handleError)
  })
}

export class CodexServerService {
  private process: ChildProcessWithoutNullStreams | null = null
  private isDisposingProcess = false
  private readonly pendingTurnStartRequestIds = new Set<number | string>()
  private readonly activeTurnIds = new Set<string>()
  private readonly messageListeners = new Set<(message: string) => void>()
  private readonly statusListeners = new Set<(status: string) => void>()
  private readonly diagnosticListeners = new Set<(diagnostic: CodexServerDiagnostic) => void>()

  constructor(
    private readonly sendEvent: EventSender,
    private readonly providerSettingsService?: ProviderSettingsService
  ) {}

  async ensureServer(): Promise<string> {
    if (this.process && this.process.exitCode == null && !this.process.killed) {
      return "Codex App Server already running"
    }

    let hasReportedUnexpectedExit = false
    this.isDisposingProcess = false

    const settings = await this.providerSettingsService?.getProviderSettings("codex")
    const { command, env } = settings
      ? await resolveProviderCommand({
          binaryPath: settings.binaryPath,
          executableName: process.platform === "win32" ? "codex.exe" : "codex",
          envOverride: settings.homePath ? { CODEX_HOME: settings.homePath } : undefined,
        })
      : await resolveCodexLaunchConfig()
    const child = spawn(command, ["app-server"], {
      stdio: "pipe",
      env,
    })

    capture("agent_server_start_requested")

    child.on("error", (error) => {
      console.error("[codex] Failed to spawn Codex App Server:", error)
      captureException(error, { context: "agent_server_spawn" })
      capture("agent_server_error", { reason: "spawn_failed" })
      this.emitStatus("closed")
      this.isDisposingProcess = false
      this.process = null
    })

    child.on("exit", (code, signal) => {
      const wasIntentionalExit = this.isDisposingProcess
      this.pendingTurnStartRequestIds.clear()
      this.activeTurnIds.clear()

      if (!hasReportedUnexpectedExit && !wasIntentionalExit && (code !== 0 || signal !== null)) {
        hasReportedUnexpectedExit = true
        capture("agent_server_error", {
          reason: "process_exited",
          exit_code: code,
          signal,
        })
      }

      this.emitStatus("closed")
      this.isDisposingProcess = false
      this.process = null
    })

    readline.createInterface({ input: child.stdout }).on("line", (line) => {
      const payload = line.trim()
      if (!payload) {
        return
      }

      this.trackIncomingMessage(payload)
      this.emitMessage(payload)
    })

    readline.createInterface({ input: child.stderr }).on("line", (line) => {
      const payload = line.trim()
      if (payload) {
        const diagnostic = this.parseDiagnostic(payload)
        if (diagnostic) {
          this.emitDiagnostic(diagnostic)
          return
        }

        console.warn("[codex]", payload)
      }
    })

    this.process = child
    await waitForSpawn(child)
    return "Codex App Server started"
  }

  async send(message: string): Promise<void> {
    if (!this.process || this.process.exitCode != null || this.process.killed) {
      throw new Error("Codex App Server is not connected")
    }

    await new Promise<void>((resolve, reject) => {
      this.process?.stdin.write(`${message}\n`, (error) => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      })
    })

    this.trackOutgoingMessage(message)
  }

  dispose(): void {
    if (!this.process || this.process.killed) {
      return
    }

    this.isDisposingProcess = true
    this.pendingTurnStartRequestIds.clear()
    this.activeTurnIds.clear()
    this.process.kill()
    this.process = null
  }

  getActiveTurnCount(): number {
    return this.activeTurnIds.size + this.pendingTurnStartRequestIds.size
  }

  onMessage(listener: (message: string) => void): () => void {
    this.messageListeners.add(listener)
    return () => {
      this.messageListeners.delete(listener)
    }
  }

  onStatus(listener: (status: string) => void): () => void {
    this.statusListeners.add(listener)
    return () => {
      this.statusListeners.delete(listener)
    }
  }

  onDiagnostic(listener: (diagnostic: CodexServerDiagnostic) => void): () => void {
    this.diagnosticListeners.add(listener)
    return () => {
      this.diagnosticListeners.delete(listener)
    }
  }

  private emitMessage(message: string): void {
    this.sendEvent(EVENT_CHANNELS.codexMessage, message)
    for (const listener of this.messageListeners) {
      listener(message)
    }
  }

  private emitStatus(status: string): void {
    this.sendEvent(EVENT_CHANNELS.codexStatus, status)
    for (const listener of this.statusListeners) {
      listener(status)
    }
  }

  private emitDiagnostic(diagnostic: CodexServerDiagnostic): void {
    for (const listener of this.diagnosticListeners) {
      listener(diagnostic)
    }
  }

  private parseDiagnostic(message: string): CodexServerDiagnostic | null {
    if (!/TokenRefreshFailed|invalid_grant|Invalid refresh token/i.test(message)) {
      return null
    }

    if (!/mcp|rmcp|OAuth|refresh token/i.test(message)) {
      return null
    }

    return {
      kind: "mcp-auth",
      severity: "warning",
      message:
        "Codex could not authenticate one MCP connector because its refresh token expired. The turn will continue without that connector. Run `codex mcp login <name>` to reconnect it.",
      rawMessage: message,
    }
  }

  private trackOutgoingMessage(rawMessage: string): void {
    const payload = this.parseJsonMessage(rawMessage)
    if (!payload || typeof payload !== "object" || !("method" in payload)) {
      return
    }

    if (payload.method === "turn/start" && "id" in payload) {
      this.pendingTurnStartRequestIds.add(payload.id)
      return
    }

    if (payload.method === "turn/interrupt") {
      const params =
        "params" in payload && payload.params && typeof payload.params === "object"
          ? payload.params
          : null
      const turnId = params && "turnId" in params && typeof params.turnId === "string"
        ? params.turnId
        : null

      if (turnId) {
        this.activeTurnIds.delete(turnId)
      }
    }
  }

  private trackIncomingMessage(rawMessage: string): void {
    const payload = this.parseJsonMessage(rawMessage)
    if (!payload || typeof payload !== "object") {
      return
    }

    if ("id" in payload && !("method" in payload)) {
      if (this.pendingTurnStartRequestIds.has(payload.id)) {
        this.pendingTurnStartRequestIds.delete(payload.id)
        const turnId =
          "result" in payload &&
            payload.result &&
            typeof payload.result === "object" &&
            "turn" in payload.result &&
            payload.result.turn &&
            typeof payload.result.turn === "object" &&
            "id" in payload.result.turn &&
            typeof payload.result.turn.id === "string"
            ? payload.result.turn.id
            : null

        if (turnId) {
          this.activeTurnIds.add(turnId)
        }
      }

      return
    }

    if (!("method" in payload) || payload.method !== "turn/completed") {
      return
    }

    const params =
      "params" in payload && payload.params && typeof payload.params === "object"
        ? payload.params
        : null
    const turnId =
      params &&
        "turn" in params &&
        params.turn &&
        typeof params.turn === "object" &&
        "id" in params.turn &&
        typeof params.turn.id === "string"
        ? params.turn.id
        : null

    if (turnId) {
      this.activeTurnIds.delete(turnId)
    }
  }

  private parseJsonMessage(rawMessage: string): Record<string, unknown> | null {
    try {
      const parsed = JSON.parse(rawMessage) as unknown
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null
    } catch {
      return null
    }
  }
}
