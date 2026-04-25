import { EventEmitter } from "node:events"
import { PassThrough } from "node:stream"
import { beforeEach, describe, expect, mock, test } from "bun:test"

const executablePaths = new Set<string>()
const spawnedChildren: FakeChildProcess[] = []
const spawnCalls: Array<{ command: string; args: string[]; options: { env?: NodeJS.ProcessEnv } }> =
  []

const accessSyncMock = mock((filePath: string) => {
  if (!executablePaths.has(filePath)) {
    throw new Error(`ENOENT: ${filePath}`)
  }
})
const statSyncMock = mock(() => ({ isFile: () => true }))
const homedirMock = mock(() => "/Users/tester")
const spawnMock = mock(
  (command: string, args: string[], options: { env?: NodeJS.ProcessEnv }) => {
    spawnCalls.push({ command, args, options })
    const child = new FakeChildProcess()
    spawnedChildren.push(child)
    return child as unknown as import("node:child_process").ChildProcessWithoutNullStreams
  }
)
const execFileSyncMock = mock(() => "")
const createServerMock = mock(() => new FakeNetServer())

mock.module("node:fs", () => ({
  accessSync: accessSyncMock,
  constants: { X_OK: 1 },
  statSync: statSyncMock,
}))

mock.module("node:os", () => ({
  default: { homedir: homedirMock },
  homedir: homedirMock,
}))

mock.module("node:child_process", () => ({
  execFileSync: execFileSyncMock,
  spawn: spawnMock,
}))

mock.module("node:net", () => ({
  default: { createServer: createServerMock },
  createServer: createServerMock,
}))

class FakeChildProcess extends EventEmitter {
  stdout = new PassThrough()
  stderr = new PassThrough()
  exitCode: number | null = null
  signalCode: NodeJS.Signals | null = null
  killed = false

  kill() {
    this.killed = true
    this.emit("exit", 0, null)
    return true
  }
}

class FakeNetServer extends EventEmitter {
  once(eventName: string | symbol, listener: (...args: unknown[]) => void) {
    return super.once(eventName, listener)
  }

  listen(_port: number, _hostname: string, callback: () => void) {
    queueMicrotask(callback)
    return this
  }

  address() {
    return { address: "127.0.0.1", family: "IPv4", port: 5123 }
  }

  close(callback: () => void) {
    queueMicrotask(callback)
    return this
  }
}

async function waitForSpawnedChild(index = 0): Promise<FakeChildProcess> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const child = spawnedChildren[index]
    if (child) {
      return child
    }

    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  throw new Error(`Expected spawned child at index ${index}`)
}

const { OpenCodeServerService } = await import("./opencodeServer")

describe("OpenCodeServerService", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    executablePaths.clear()
    spawnedChildren.length = 0
    spawnCalls.length = 0
    accessSyncMock.mockClear()
    statSyncMock.mockClear()
    homedirMock.mockClear()
    homedirMock.mockReturnValue("/Users/tester")
    spawnMock.mockClear()
    execFileSyncMock.mockClear()
    execFileSyncMock.mockReturnValue("")
    createServerMock.mockClear()

    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key]
      }
    }

    Object.assign(process.env, originalEnv)
    process.env.PATH = "/usr/bin:/bin:/usr/sbin:/sbin"
  })

  test("uses a configured external OpenCode server without spawning a CLI", async () => {
    const service = new OpenCodeServerService({
      getProviderSettings: async () => ({
        enabled: true,
        binaryPath: "opencode",
        serverUrl: "http://127.0.0.1:4096",
        serverPassword: "",
        customModels: [],
      }),
    } as never)

    await expect(service.getBaseUrl()).resolves.toBe("http://127.0.0.1:4096")
    expect(spawnMock).not.toHaveBeenCalled()
  })

  test("spawns the configured OpenCode CLI and parses the listening URL", async () => {
    executablePaths.add("/Users/tester/.bun/bin/opencode")

    const service = new OpenCodeServerService()
    const baseUrlPromise = service.getBaseUrl()

    const child = await waitForSpawnedChild()
    child.stdout.write("opencode server listening on http://127.0.0.1:5123\n")

    await expect(baseUrlPromise).resolves.toBe("http://127.0.0.1:5123")
    expect(spawnCalls[0]?.command).toBe("/Users/tester/.bun/bin/opencode")
    expect(spawnCalls[0]?.args).toEqual([
      "serve",
      "--hostname=127.0.0.1",
      "--port=5123",
    ])
  })

  test("clears failed startup state so later attempts can retry cleanly", async () => {
    executablePaths.add("/Users/tester/.bun/bin/opencode")

    const service = new OpenCodeServerService()
    const firstAttempt = service.getBaseUrl()
    const firstChild = await waitForSpawnedChild()
    firstChild.emit("error", new Error("boom"))

    await expect(firstAttempt).rejects.toThrow("boom")

    const secondAttempt = service.getBaseUrl()
    const secondChild = await waitForSpawnedChild(1)
    secondChild.stdout.write(
      "opencode server listening on http://127.0.0.1:5123\n"
    )

    await expect(secondAttempt).resolves.toBe("http://127.0.0.1:5123")
    expect(spawnMock).toHaveBeenCalledTimes(2)
  })
})
