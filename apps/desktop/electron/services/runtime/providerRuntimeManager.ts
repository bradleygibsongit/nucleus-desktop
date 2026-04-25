import { execFile } from "node:child_process"
import { promisify } from "node:util"
import type {
  RuntimeProviderSettingsBase,
  RuntimeProviderStatus,
} from "@/desktop/contracts"
import type { HarnessId, RuntimeModel } from "@/features/chat/types"
import type { RuntimeProviderAdapter } from "./providerTypes"
import { ProviderSettingsService, resolveProviderCommand } from "./providerSettings"

const execFileAsync = promisify(execFile)
const PROVIDER_IDS: HarnessId[] = ["codex", "claude-code", "opencode"]

type ProviderGetter = (harnessId: HarnessId) => RuntimeProviderAdapter

function getExecutableName(harnessId: HarnessId): string {
  switch (harnessId) {
    case "claude-code":
      return process.platform === "win32" ? "claude.exe" : "claude"
    case "opencode":
      return process.platform === "win32" ? "opencode.exe" : "opencode"
    case "codex":
    default:
      return process.platform === "win32" ? "codex.exe" : "codex"
  }
}

function getProviderLabel(harnessId: HarnessId): string {
  switch (harnessId) {
    case "claude-code":
      return "Claude"
    case "opencode":
      return "OpenCode"
    case "codex":
    default:
      return "Codex"
  }
}

function parseVersion(output: string): string | null {
  return output.match(/\b(\d+\.\d+\.\d+)\b/)?.[1] ?? null
}

function parseClaudeAuthStatus(output: string): RuntimeProviderStatus["auth"] {
  const normalized = output.toLowerCase()
  if (
    normalized.includes("authenticated") ||
    normalized.includes("logged in") ||
    normalized.includes('"authenticated":true') ||
    normalized.includes('"loggedin":true')
  ) {
    return { status: "authenticated", type: "claude" }
  }

  if (
    normalized.includes("not authenticated") ||
    normalized.includes("not logged in") ||
    normalized.includes('"authenticated":false') ||
    normalized.includes('"loggedin":false')
  ) {
    return { status: "unauthenticated", type: "claude" }
  }

  return { status: "unknown", type: "claude" }
}

function modelsFromCustomSettings(
  settings: RuntimeProviderSettingsBase,
  providerName: string
): RuntimeModel[] {
  return settings.customModels.map((modelId) => ({
    id: modelId,
    displayName: modelId,
    providerName,
    isDefault: false,
    supportedReasoningEfforts: [],
    defaultReasoningEffort: null,
    supportsFastMode: false,
  }))
}

async function runCli(input: {
  command: string
  args: string[]
  env: NodeJS.ProcessEnv
  timeoutMs?: number
}): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await execFileAsync(input.command, input.args, {
    env: input.env,
    timeout: input.timeoutMs ?? 8_000,
  })
  return { stdout, stderr }
}

export class ProviderRuntimeManager {
  private statusCache = new Map<HarnessId, RuntimeProviderStatus>()

  constructor(
    private readonly settingsService: ProviderSettingsService,
    private readonly getProvider: ProviderGetter
  ) {}

  async listProviderStatuses(): Promise<RuntimeProviderStatus[]> {
    const statuses = await Promise.all(PROVIDER_IDS.map((harnessId) => this.getStatus(harnessId)))
    return statuses
  }

  async refreshProviderStatus(harnessId: HarnessId): Promise<RuntimeProviderStatus> {
    this.statusCache.delete(harnessId)
    return this.getStatus(harnessId)
  }

  private async getStatus(harnessId: HarnessId): Promise<RuntimeProviderStatus> {
    const cached = this.statusCache.get(harnessId)
    if (cached && Date.now() - cached.checkedAt < 5 * 60 * 1000) {
      return cached
    }

    const status = await this.probeProvider(harnessId)
    this.statusCache.set(harnessId, status)
    return status
  }

  private async probeProvider(harnessId: HarnessId): Promise<RuntimeProviderStatus> {
    const settings = await this.settingsService.getProviderSettings(harnessId)
    const label = getProviderLabel(harnessId)
    const checkedAt = Date.now()

    if (!settings.enabled) {
      return {
        harnessId,
        enabled: false,
        installed: false,
        version: null,
        auth: { status: "unknown" },
        models: modelsFromCustomSettings(settings, label),
        message: `${label} is disabled in coding provider settings.`,
        checkedAt,
      }
    }

    try {
      const externalOpenCode =
        harnessId === "opencode" && "serverUrl" in settings && settings.serverUrl.trim()
      let version: string | null = null

      if (!externalOpenCode) {
        const { command, env } = await resolveProviderCommand({
          binaryPath: settings.binaryPath,
          executableName: getExecutableName(harnessId),
          envOverride:
            harnessId === "codex" && "homePath" in settings && settings.homePath
              ? { CODEX_HOME: settings.homePath }
              : undefined,
        })
        const versionOutput = await runCli({
          command,
          args: ["--version"],
          env,
          timeoutMs: 5_000,
        })
        version = parseVersion(`${versionOutput.stdout}\n${versionOutput.stderr}`)
      }

      const auth =
        harnessId === "claude-code"
          ? await this.probeClaudeAuth(settings.binaryPath)
          : ({ status: "unknown", type: harnessId } as const)
      const models = await this.getProvider(harnessId).listModels()
      const mergedModels = mergeModels(models, modelsFromCustomSettings(settings, label))
      const hasModels = mergedModels.length > 0

      return {
        harnessId,
        enabled: true,
        installed: true,
        version,
        auth:
          auth.status !== "unknown"
            ? auth
            : { status: hasModels ? "authenticated" : "unknown", type: harnessId },
        models: mergedModels,
        message: hasModels
          ? `${label} is ready with ${mergedModels.length} ${mergedModels.length === 1 ? "model" : "models"}.`
          : `${label} is available, but no models were reported.`,
        checkedAt,
      }
    } catch (error) {
      return {
        harnessId,
        enabled: true,
        installed: !isMissingCommandError(error),
        version: null,
        auth: { status: isAuthError(error) ? "unauthenticated" : "unknown", type: harnessId },
        models: modelsFromCustomSettings(settings, label),
        message: normalizeStatusError(label, error),
        checkedAt,
      }
    }
  }

  private async probeClaudeAuth(binaryPath: string): Promise<RuntimeProviderStatus["auth"]> {
    try {
      const { command, env } = await resolveProviderCommand({
        binaryPath,
        executableName: getExecutableName("claude-code"),
      })
      const output = await runCli({
        command,
        args: ["auth", "status"],
        env,
        timeoutMs: 10_000,
      })
      return parseClaudeAuthStatus(`${output.stdout}\n${output.stderr}`)
    } catch {
      return { status: "unknown", type: "claude" }
    }
  }
}

function mergeModels(primary: RuntimeModel[], custom: RuntimeModel[]): RuntimeModel[] {
  return Array.from(
    new Map([...primary, ...custom].map((model) => [model.id, model])).values()
  )
}

function isMissingCommandError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /enoent|not found|unable to find/i.test(message)
}

function isAuthError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /auth|login|unauthorized|forbidden|401|403/i.test(message)
}

function normalizeStatusError(label: string, error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error)
  if (isMissingCommandError(error)) {
    return `${label} CLI is not installed or not on PATH.`
  }

  return `Failed to check ${label}: ${detail}`
}
