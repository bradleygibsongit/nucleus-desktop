import { accessSync, constants, statSync } from "node:fs"
import * as childProcess from "node:child_process"
import os from "node:os"
import path from "node:path"

const PATH_SEPARATOR = process.platform === "win32" ? ";" : ":"
const LOGIN_SHELL_ENV_NAMES = [
  "PATH",
  "SSH_AUTH_SOCK",
  "HOMEBREW_PREFIX",
  "HOMEBREW_CELLAR",
  "HOMEBREW_REPOSITORY",
] as const

export function splitPathEntries(pathValue: string | null | undefined): string[] {
  return (pathValue ?? "")
    .split(PATH_SEPARATOR)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

export function mergePathEntries(...pathValues: Array<string | null | undefined>): string {
  return Array.from(new Set(pathValues.flatMap(splitPathEntries))).join(PATH_SEPARATOR)
}

export function getCommonPathEntries(): string[] {
  const homeDirectory = os.homedir()

  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA?.trim()
    return [
      process.env.USERPROFILE?.trim(),
      localAppData ? path.join(localAppData, "Programs") : null,
      localAppData ? path.join(localAppData, "Microsoft", "WinGet", "Links") : null,
    ].filter((entry): entry is string => Boolean(entry))
  }

  return [
    path.join(homeDirectory, ".bun", "bin"),
    path.join(homeDirectory, ".local", "bin"),
    path.join(homeDirectory, ".cargo", "bin"),
    path.join(homeDirectory, ".npm-global", "bin"),
    "/opt/homebrew/bin",
    "/opt/homebrew/sbin",
    "/usr/local/bin",
    "/usr/local/sbin",
    "/opt/local/bin",
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin",
  ]
}

export function isExecutableFile(filePath: string | null | undefined): filePath is string {
  if (!filePath) {
    return false
  }

  try {
    accessSync(filePath, constants.X_OK)
    return statSync(filePath).isFile()
  } catch {
    return false
  }
}

function getShellCandidates(): string[] {
  if (process.platform === "win32") {
    return []
  }

  const candidates = [process.env.SHELL?.trim(), "/bin/zsh", "/bin/bash", "/bin/sh"]
  return Array.from(
    new Set(
      candidates.filter(
        (candidate): candidate is string =>
          Boolean(candidate) && candidate.startsWith("/") && isExecutableFile(candidate)
      )
    )
  )
}

function quoteShellEnvName(name: string): string {
  return name.replace(/[^A-Z0-9_]/gi, "")
}

function readLoginShellEnvironment(shell: string): Partial<Record<string, string>> {
  const script = LOGIN_SHELL_ENV_NAMES.map(
    (name) => `printf '%s=%s\\n' ${quoteShellEnvName(name)} "$${quoteShellEnvName(name)}"`
  ).join("; ")
  const output = childProcess.execFileSync(shell, ["-lc", script], {
    env: {
      ...process.env,
      HOME: os.homedir(),
    },
    encoding: "utf8",
    timeout: 3_000,
  })
  const environment: Partial<Record<string, string>> = {}

  for (const line of output.split(/\r?\n/)) {
    const separator = line.indexOf("=")
    if (separator <= 0) {
      continue
    }

    const key = line.slice(0, separator)
    const value = line.slice(separator + 1)
    if (LOGIN_SHELL_ENV_NAMES.includes(key as (typeof LOGIN_SHELL_ENV_NAMES)[number]) && value) {
      environment[key] = value
    }
  }

  return environment
}

function readLaunchctlPath(): string | null {
  if (process.platform !== "darwin") {
    return null
  }

  try {
    const output = childProcess.execFileSync("/bin/launchctl", ["getenv", "PATH"], {
      encoding: "utf8",
      timeout: 2_000,
    }).trim()
    return output || null
  } catch {
    return null
  }
}

export function buildLaunchPath(additionalEntries: string[] = []): string {
  return mergePathEntries(
    process.env.PATH,
    additionalEntries.join(PATH_SEPARATOR),
    getCommonPathEntries().join(PATH_SEPARATOR)
  )
}

export function findExecutableInPath(executableName: string, pathValue: string): string | null {
  for (const directory of splitPathEntries(pathValue)) {
    const candidate = path.join(directory, executableName)
    if (isExecutableFile(candidate)) {
      return candidate
    }
  }

  return null
}

export function applyShellEnvironment(
  env: NodeJS.ProcessEnv,
  shellEnvironment: Partial<Record<string, string>>,
  launchctlPath: string | null = null
): void {
  env.PATH = mergePathEntries(
    shellEnvironment.PATH,
    launchctlPath,
    env.PATH,
    getCommonPathEntries().join(PATH_SEPARATOR)
  )

  for (const name of LOGIN_SHELL_ENV_NAMES) {
    if (name === "PATH") {
      continue
    }

    if (!env[name] && shellEnvironment[name]) {
      env[name] = shellEnvironment[name]
    }
  }
}

export function syncShellEnvironment(env: NodeJS.ProcessEnv = process.env): void {
  if (process.platform !== "darwin" && process.platform !== "linux") {
    env.PATH = buildLaunchPath()
    return
  }

  let shellEnvironment: Partial<Record<string, string>> = {}

  for (const shell of getShellCandidates()) {
    try {
      shellEnvironment = readLoginShellEnvironment(shell)
      if (shellEnvironment.PATH) {
        break
      }
    } catch (error) {
      console.warn("[desktop] Failed to read login shell environment:", error)
    }
  }

  const launchctlPath = shellEnvironment.PATH ? null : readLaunchctlPath()
  applyShellEnvironment(env, shellEnvironment, launchctlPath)
}
