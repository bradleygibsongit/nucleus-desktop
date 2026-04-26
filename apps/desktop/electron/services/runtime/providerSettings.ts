import os from "node:os"
import path from "node:path"
import type {
  RuntimeProviderSettingsRecord,
  RuntimeProviderSettingsBase,
} from "@/desktop/contracts"
import type { HarnessId } from "@/features/chat/types"
import { SETTINGS_STORE_FILE } from "../windowTheme"
import { JsonStoreService } from "../store"
import {
  buildLaunchPath,
  findExecutableInPath,
  isExecutableFile,
} from "../shellEnvironment"

export const PROVIDER_SETTINGS_KEY = "providerSettings"

export const DEFAULT_PROVIDER_SETTINGS: RuntimeProviderSettingsRecord = Object.freeze({
  codex: {
    enabled: true,
    binaryPath: "codex",
    homePath: "",
    customModels: [],
  },
  "claude-code": {
    enabled: true,
    binaryPath: "claude",
    launchArgs: "",
    customModels: [],
  },
  opencode: {
    enabled: true,
    binaryPath: "opencode",
    serverUrl: "",
    serverPassword: "",
    customModels: [],
  },
})

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeCustomModels(value: unknown): string[] {
  return Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map((model) => normalizeString(model))
        .filter((model) => model.length > 0)
    )
  )
}

function normalizeBaseSettings(
  value: Partial<RuntimeProviderSettingsBase> | null | undefined,
  fallback: RuntimeProviderSettingsBase
): RuntimeProviderSettingsBase {
  const binaryPath = normalizeString(value?.binaryPath)

  return {
    enabled: value?.enabled === false ? false : fallback.enabled,
    binaryPath: binaryPath || fallback.binaryPath,
    customModels: normalizeCustomModels(value?.customModels),
  }
}

export function normalizeProviderSettings(value: unknown): RuntimeProviderSettingsRecord {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Partial<RuntimeProviderSettingsRecord>)
      : {}
  const codexBase = normalizeBaseSettings(source.codex, DEFAULT_PROVIDER_SETTINGS.codex)
  const claudeBase = normalizeBaseSettings(
    source["claude-code"],
    DEFAULT_PROVIDER_SETTINGS["claude-code"]
  )
  const openCodeBase = normalizeBaseSettings(source.opencode, DEFAULT_PROVIDER_SETTINGS.opencode)

  return {
    codex: {
      ...codexBase,
      homePath: normalizeString(source.codex?.homePath),
    },
    "claude-code": {
      ...claudeBase,
      launchArgs: normalizeString(source["claude-code"]?.launchArgs),
    },
    opencode: {
      ...openCodeBase,
      serverUrl: normalizeString(source.opencode?.serverUrl),
      serverPassword: normalizeString(source.opencode?.serverPassword),
    },
  }
}

export class ProviderSettingsService {
  constructor(private readonly storeService: JsonStoreService) {}

  async getSettings(): Promise<RuntimeProviderSettingsRecord> {
    const saved = await this.storeService.get<unknown>(SETTINGS_STORE_FILE, PROVIDER_SETTINGS_KEY)
    return normalizeProviderSettings(saved)
  }

  async getProviderSettings<T extends HarnessId>(
    harnessId: T
  ): Promise<RuntimeProviderSettingsRecord[T]> {
    const settings = await this.getSettings()
    return settings[harnessId]
  }
}

export interface ResolvedProviderCommand {
  command: string
  env: NodeJS.ProcessEnv
}

export async function resolveProviderCommand(input: {
  binaryPath: string
  executableName: string
  envOverride?: Record<string, string | undefined>
}): Promise<ResolvedProviderCommand> {
  const configured = input.binaryPath.trim()
  const envPath = buildLaunchPath()

  let command: string | null = null
  if (configured.includes("/") || configured.includes("\\")) {
    command = isExecutableFile(configured) ? configured : null
  } else {
    command = findExecutableInPath(
      process.platform === "win32" && !configured.endsWith(".exe")
        ? `${configured}.exe`
        : configured,
      envPath
    )
    command ??= findExecutableInPath(input.executableName, envPath)
  }

  if (!command && input.executableName === "codex") {
    const configuredExecutable = process.env.VFACTOR_CODEX_PATH?.trim()
    command = isExecutableFile(configuredExecutable) ? configuredExecutable : null
  }

  if (!command && input.executableName === "claude") {
    const configuredExecutable = process.env.VFACTOR_CLAUDE_PATH?.trim()
    command = isExecutableFile(configuredExecutable) ? configuredExecutable : null
  }

  if (!command) {
    throw new Error(
      `Unable to find ${input.executableName}. Install it, add it to PATH, or set the provider binary path.`
    )
  }

  const homePath = input.envOverride?.HOME || os.homedir()
  const additionalEntries = [path.dirname(command)]
  return {
    command,
    env: {
      ...process.env,
      ...input.envOverride,
      HOME: homePath,
      PATH: buildLaunchPath(additionalEntries),
    },
  }
}
