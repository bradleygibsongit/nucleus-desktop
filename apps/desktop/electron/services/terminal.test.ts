import { beforeEach, describe, expect, mock, test } from "bun:test"
import { mkdtemp, mkdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

const spawnMock = mock((_shell: string, _args: string[], options: { cwd: string }) =>
  createFakePty(options.cwd)
)

mock.module("node-pty", () => ({
  default: {
    spawn: spawnMock,
  },
  spawn: spawnMock,
}))

const { TerminalService } = await import("./terminal")

interface FakePty {
  cwd: string
  kill: ReturnType<typeof mock>
  resize: ReturnType<typeof mock>
  write: ReturnType<typeof mock>
  onData: (listener: (data: string) => void) => { dispose: () => void }
  onExit: (listener: (event: { exitCode: number }) => void) => { dispose: () => void }
}

const fakePtys: FakePty[] = []

function createFakePty(cwd: string): FakePty {
  let exitListener: ((event: { exitCode: number }) => void) | null = null

  const pty: FakePty = {
    cwd,
    kill: mock(() => {
      exitListener?.({ exitCode: 0 })
    }),
    resize: mock(() => {}),
    write: mock(() => {}),
    onData: () => ({ dispose: () => {} }),
    onExit: (listener) => {
      exitListener = listener
      return {
        dispose: () => {
          if (exitListener === listener) {
            exitListener = null
          }
        },
      }
    },
  }

  fakePtys.push(pty)
  return pty
}

describe("TerminalService", () => {
  beforeEach(() => {
    fakePtys.length = 0
    spawnMock.mockReset()
    spawnMock.mockImplementation((_shell: string, _args: string[], options: { cwd: string }) =>
      createFakePty(options.cwd)
    )
  })

  test("recreates an existing session when the requested cwd changes", async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), "nucleus-terminal-test-"))
    const firstDir = path.join(rootDir, "first")
    const secondDir = path.join(rootDir, "second")
    const sendEvent = mock(() => {})

    await mkdir(firstDir, { recursive: true })
    await mkdir(secondDir, { recursive: true })

    try {
      const service = new TerminalService(sendEvent)

      await service.createSession("session-1", firstDir, 80, 24)
      await service.createSession("session-1", secondDir, 100, 30)

      expect(spawnMock).toHaveBeenCalledTimes(2)
      expect(fakePtys[0]?.kill).toHaveBeenCalledTimes(1)
      expect(fakePtys[1]?.cwd).toBe(secondDir)
      expect(sendEvent).not.toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
        sessionId: "session-1",
        exitCode: 0,
      }))
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })
})
