import { beforeEach, describe, expect, mock, test } from "bun:test"

const appMock = {
  isPackaged: true,
  getVersion: mock(() => "0.1.1"),
}

const existsSyncMock = mock(() => true)
const captureMock = mock(() => {})
const captureExceptionMock = mock(() => {})

const onceListeners = new Map<string, (payload?: unknown) => void>()

const autoUpdater = {
  autoDownload: true,
  autoInstallOnAppQuit: true,
  once: mock((event: string, listener: (payload?: unknown) => void) => {
    onceListeners.set(event, listener)
  }),
  on: mock(() => autoUpdater),
  removeListener: mock((event: string, listener: (payload?: unknown) => void) => {
    if (onceListeners.get(event) === listener) {
      onceListeners.delete(event)
    }
  }),
  checkForUpdates: mock(async () => {}),
  downloadUpdate: mock(async () => {}),
  quitAndInstall: mock(() => {}),
}

mock.module("electron", () => ({
  app: appMock,
}))

mock.module("node:fs", () => ({
  existsSync: existsSyncMock,
}))

mock.module("electron-updater", () => ({
  default: { autoUpdater },
  autoUpdater,
}))

mock.module("./analytics", () => ({
  capture: captureMock,
  captureException: captureExceptionMock,
}))

const { UpdaterService } = await import("./updater")
const originalResourcesPath = process.resourcesPath

describe("UpdaterService.checkForUpdates", () => {
  beforeEach(() => {
    Object.defineProperty(process, "resourcesPath", {
      configurable: true,
      value: "/tmp/nucleus-test-resources",
    })
    appMock.isPackaged = true
    existsSyncMock.mockReset()
    existsSyncMock.mockReturnValue(true)
    captureMock.mockReset()
    captureExceptionMock.mockReset()
    appMock.getVersion.mockReset()
    appMock.getVersion.mockReturnValue("0.1.1")
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.once.mockReset()
    autoUpdater.once.mockImplementation((event: string, listener: (payload?: unknown) => void) => {
      onceListeners.set(event, listener)
    })
    autoUpdater.on.mockReset()
    autoUpdater.on.mockImplementation(() => autoUpdater)
    autoUpdater.removeListener.mockReset()
    autoUpdater.removeListener.mockImplementation((event: string, listener: (payload?: unknown) => void) => {
      if (onceListeners.get(event) === listener) {
        onceListeners.delete(event)
      }
    })
    autoUpdater.checkForUpdates.mockReset()
    autoUpdater.checkForUpdates.mockImplementation(async () => {})
    autoUpdater.downloadUpdate.mockReset()
    autoUpdater.quitAndInstall.mockReset()
    onceListeners.clear()
  })

  test("returns early for unpackaged builds", async () => {
    appMock.isPackaged = false

    const service = new UpdaterService(() => {})
    const result = await service.checkForUpdates()

    expect(result).toBeNull()
    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled()
  })

  test("throws a friendly error when the update config is missing", async () => {
    existsSyncMock.mockReturnValue(false)

    const service = new UpdaterService(() => {})

    await expect(service.checkForUpdates()).rejects.toThrow(
      "In-app updates are unavailable in this build. Install Nucleus from a signed GitHub release to use the updater."
    )

    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled()
    expect(captureMock).toHaveBeenCalledWith(
      "update_check_unavailable",
      expect.objectContaining({
        reason: "missing_update_config",
        current_version: "0.1.1",
      })
    )
  })

  test("maps update information when an update is available", async () => {
    autoUpdater.checkForUpdates.mockImplementation(async () => {
      onceListeners.get("update-available")?.({
        version: "0.2.0",
        releaseName: "Nucleus 0.2.0",
        releaseDate: "2026-04-05T18:00:00.000Z",
      })
    })

    const service = new UpdaterService(() => {})
    const result = await service.checkForUpdates()

    expect(result).toEqual({
      version: "0.2.0",
      currentVersion: "0.1.1",
      notes: "Nucleus 0.2.0",
      pubDate: "2026-04-05T18:00:00.000Z",
      target: process.platform,
    })
    expect(autoUpdater.autoDownload).toBe(false)
    expect(autoUpdater.autoInstallOnAppQuit).toBe(false)
  })
})

Object.defineProperty(process, "resourcesPath", {
  configurable: true,
  value: originalResourcesPath,
})
