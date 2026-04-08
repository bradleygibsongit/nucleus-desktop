import { existsSync } from "node:fs"
import { join } from "node:path"
import { app } from "electron"
import electronUpdater from "electron-updater"
import type { ProgressInfo, UpdateInfo } from "electron-updater"
import type { AppUpdateDownloadEvent, AppUpdateInfo } from "../../src/desktop/contracts"
import { EVENT_CHANNELS } from "../ipc/channels"
import { capture, captureException } from "./analytics"

const { autoUpdater } = electronUpdater
const APP_UPDATE_CONFIG = "app-update.yml"
const UPDATE_AUTH_HEADER_ENV = "NUCLEUS_UPDATE_AUTH_HEADER"
const UPDATE_CHANNEL_ENV = "NUCLEUS_UPDATE_CHANNEL"
const UPDATE_UNAVAILABLE_MESSAGE =
  "In-app updates are unavailable in this build. Download the latest Nucleus release manually to update."
const PRIVATE_GITHUB_RELEASES_MESSAGE =
  "Automatic updates are unavailable because this build checks a private or inaccessible GitHub Releases feed. Publish updates from a public release feed or install the latest release manually."

type EventSender = (channel: string, payload: unknown) => void

function mapUpdateInfo(info: UpdateInfo): AppUpdateInfo {
  return {
    version: info.version,
    currentVersion: app.getVersion(),
    notes:
      typeof info.releaseNotes === "string"
        ? info.releaseNotes
        : info.releaseName ?? null,
    pubDate: info.releaseDate ?? null,
    target: process.platform,
  }
}

function normalizeUpdateError(error: unknown): Error {
  if (!(error instanceof Error)) {
    return new Error(String(error))
  }

  const message = error.message
  const isGithubFeed404 =
    message.includes("releases.atom") &&
    message.includes("github.com") &&
    (message.includes("HttpError: 404") ||
      message.includes("status maybe not reported, but 404") ||
      message.includes("authentication token is correct"))

  if (isGithubFeed404) {
    return new Error(PRIVATE_GITHUB_RELEASES_MESSAGE)
  }

  return error
}

function readConfiguredEnv(name: string): string | null {
  const value = process.env[name]?.trim()
  return value ? value : null
}

export class UpdaterService {
  private availableUpdate: UpdateInfo | null = null
  private isBound = false

  constructor(private readonly sendEvent: EventSender) {
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = false
  }

  async checkForUpdates(): Promise<AppUpdateInfo | null> {
    if (!app.isPackaged) {
      return null
    }

    const updateConfigPath = this.getUpdateConfigPath()
    if (!existsSync(updateConfigPath)) {
      capture("update_check_unavailable", {
        reason: "missing_update_config",
        config_path: updateConfigPath,
        current_version: app.getVersion(),
      })
      throw new Error(UPDATE_UNAVAILABLE_MESSAGE)
    }

    this.configureProvider()
    this.bindEvents()

    this.availableUpdate = null
    let sawAvailable = false

    const availableListener = (info: UpdateInfo) => {
      sawAvailable = true
      this.availableUpdate = info
    }

    autoUpdater.once("update-available", availableListener)
    autoUpdater.once("update-not-available", () => {
      sawAvailable = false
      this.availableUpdate = null
    })

    try {
      await autoUpdater.checkForUpdates()
    } catch (error) {
      throw normalizeUpdateError(error)
    } finally {
      autoUpdater.removeListener("update-available", availableListener)
    }

    const result = sawAvailable && this.availableUpdate ? mapUpdateInfo(this.availableUpdate) : null
    capture("update_available_checked", {
      update_found: Boolean(result),
      available_version: result?.version ?? null,
      current_version: app.getVersion(),
    })
    return result
  }

  async installUpdate(): Promise<void> {
    if (!this.availableUpdate) {
      throw new Error("There is no pending app update to install.")
    }

    this.configureProvider()
    capture("update_install_started", {
      target_version: this.availableUpdate.version,
      current_version: app.getVersion(),
    })

    this.bindEvents()
    const startedPayload: AppUpdateDownloadEvent = {
      event: "started",
      chunkLength: null,
      downloaded: 0,
      contentLength: null,
    }
    this.sendEvent(EVENT_CHANNELS.appUpdate, startedPayload)

    await autoUpdater.downloadUpdate()
    autoUpdater.quitAndInstall()
  }

  private configureProvider(): void {
    const authHeader = readConfiguredEnv(UPDATE_AUTH_HEADER_ENV)
    if (authHeader) {
      autoUpdater.addAuthHeader(authHeader)
    }

    const channel = readConfiguredEnv(UPDATE_CHANNEL_ENV)
    if (channel) {
      autoUpdater.channel = channel
    }
  }

  private bindEvents(): void {
    if (this.isBound) {
      return
    }

    autoUpdater.on("download-progress", (progress: ProgressInfo) => {
      const payload: AppUpdateDownloadEvent = {
        event: "progress",
        chunkLength: progress.delta,
        downloaded: progress.transferred,
        contentLength: progress.total,
      }
      this.sendEvent(EVENT_CHANNELS.appUpdate, payload)
    })

    autoUpdater.on("update-downloaded", () => {
      const payload: AppUpdateDownloadEvent = {
        event: "finished",
        chunkLength: null,
        downloaded: null,
        contentLength: null,
      }
      this.sendEvent(EVENT_CHANNELS.appUpdate, payload)
    })

    autoUpdater.on("error", (error) => {
      console.error("[updates] Auto-update error:", error)
      captureException(error, { context: "auto_updater" })
    })

    this.isBound = true
  }

  private getUpdateConfigPath(): string {
    return join(process.resourcesPath, APP_UPDATE_CONFIG)
  }
}
