import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import net from "node:net"
import type { ProviderSettingsService } from "./runtime/providerSettings"
import { resolveProviderCommand } from "./runtime/providerSettings"

const DEFAULT_HOSTNAME = "127.0.0.1"
const DEFAULT_STARTUP_TIMEOUT_MS = 5_000
const SERVER_READY_PREFIX = "opencode server listening"

type RunningOpenCodeServer = {
  url: string
  external: boolean
  close(): void
}

function parseServerUrl(output: string): string | null {
  for (const line of output.split(/\r?\n/)) {
    if (!line.startsWith(SERVER_READY_PREFIX)) {
      continue
    }

    const match = line.match(/on\s+(https?:\/\/[^\s]+)/)
    if (match?.[1]) {
      return match[1]
    }
  }

  return null
}

function findAvailablePort(hostname = DEFAULT_HOSTNAME): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once("error", reject)
    server.listen(0, hostname, () => {
      const address = server.address()
      server.close(() => {
        if (address && typeof address === "object") {
          resolve(address.port)
          return
        }

        reject(new Error("Failed to resolve an available OpenCode server port."))
      })
    })
  })
}

function stopProcess(child: ChildProcessWithoutNullStreams): void {
  if (child.exitCode !== null || child.signalCode !== null || child.killed) {
    return
  }

  child.kill()
}

export class OpenCodeServerService {
  private serverPromise: Promise<RunningOpenCodeServer> | null = null
  private settingsFingerprint: string | null = null

  constructor(private readonly providerSettingsService?: ProviderSettingsService) {}

  async ensureServer(): Promise<string> {
    const server = await this.getServer()
    return server.url
  }

  async getBaseUrl(): Promise<string> {
    const server = await this.getServer()
    return server.url
  }

  async dispose(): Promise<void> {
    const serverPromise = this.serverPromise
    this.serverPromise = null
    this.settingsFingerprint = null

    if (!serverPromise) {
      return
    }

    const server = await serverPromise
    server.close()
  }

  private async getServer(): Promise<RunningOpenCodeServer> {
    const settings = await this.providerSettingsService?.getProviderSettings("opencode")
    const fingerprint = JSON.stringify({
      binaryPath: settings?.binaryPath ?? "opencode",
      serverUrl: settings?.serverUrl ?? "",
      serverPassword: settings?.serverPassword ?? "",
    })

    if (this.serverPromise && this.settingsFingerprint === fingerprint) {
      return this.serverPromise
    }

    await this.dispose()
    this.settingsFingerprint = fingerprint
    this.serverPromise = this.createServer().catch((error) => {
      this.serverPromise = null
      this.settingsFingerprint = null
      throw error
    })
    return this.serverPromise
  }

  private async createServer(): Promise<RunningOpenCodeServer> {
    const settings = await this.providerSettingsService?.getProviderSettings("opencode")
    const serverUrl = settings?.serverUrl.trim()

    if (serverUrl) {
      return {
        url: serverUrl,
        external: true,
        close() {},
      }
    }

    const port = await findAvailablePort()
    const { command, env } = await resolveProviderCommand({
      binaryPath: settings?.binaryPath ?? "opencode",
      executableName: process.platform === "win32" ? "opencode.exe" : "opencode",
    })
    const args = ["serve", `--hostname=${DEFAULT_HOSTNAME}`, `--port=${port}`]
    const child = spawn(command, args, {
      stdio: "pipe",
      env: {
        ...env,
        OPENCODE_CONFIG_CONTENT: JSON.stringify({}),
      },
      shell: process.platform === "win32",
    })

    const url = await new Promise<string>((resolve, reject) => {
      let output = ""
      let settled = false
      const timeoutId = setTimeout(() => {
        settle(() =>
          reject(
            new Error(
              `Timed out waiting for OpenCode server start after ${DEFAULT_STARTUP_TIMEOUT_MS}ms.`
            )
          )
        )
      }, DEFAULT_STARTUP_TIMEOUT_MS)

      const settle = (callback: () => void) => {
        if (settled) {
          return
        }

        settled = true
        clearTimeout(timeoutId)
        child.stdout.off("data", handleData)
        child.stderr.off("data", handleData)
        child.off("error", handleError)
        child.off("exit", handleExit)
        callback()
      }

      const handleData = (chunk: Buffer) => {
        output += chunk.toString()
        const parsedUrl = parseServerUrl(output)
        if (parsedUrl) {
          settle(() => resolve(parsedUrl))
        }
      }

      const handleError = (error: Error) => {
        settle(() => reject(error))
      }

      const handleExit = (code: number | null, signal: NodeJS.Signals | null) => {
        settle(() =>
          reject(
            new Error(
              [
                `OpenCode server exited before startup completed (code: ${String(code)}, signal: ${String(signal)}).`,
                output.trim() ? `Output:\n${output.trim()}` : null,
              ]
                .filter(Boolean)
                .join("\n\n")
            )
          )
        )
      }

      child.stdout.on("data", handleData)
      child.stderr.on("data", handleData)
      child.once("error", handleError)
      child.once("exit", handleExit)
    }).catch((error) => {
      stopProcess(child)
      throw error
    })

    return {
      url,
      external: false,
      close() {
        stopProcess(child)
      },
    }
  }
}
