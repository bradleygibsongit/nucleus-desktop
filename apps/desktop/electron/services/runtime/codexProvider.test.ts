import { beforeEach, describe, expect, mock, test } from "bun:test"
import type { RuntimeTurnUpdateEvent } from "@/desktop/contracts"
import type { RuntimeSession } from "@/features/chat/types"

const requestLog: Array<{ method: string; params: unknown }> = []
const requestHandlers = new Map<string, (params: unknown) => unknown | Promise<unknown>>()
const readFileMock = mock(async () => {
  throw new Error("missing config")
})
type DiagnosticListener = (diagnostic: {
  kind: "mcp-auth"
  severity: "warning"
  message: string
  rawMessage: string
}) => void

const diagnosticListeners = new Set<DiagnosticListener>()

const fakeCodexServer = {
  onDiagnostic: (listener: DiagnosticListener) => {
    diagnosticListeners.add(listener)
    return () => {
      diagnosticListeners.delete(listener)
    }
  },
}

class FakeMainCodexRpcClient {
  constructor(_service: unknown) {}

  async connect(): Promise<void> {}

  async request<T>(method: string, params?: unknown): Promise<T> {
    requestLog.push({ method, params })
    const handler = requestHandlers.get(method)
    if (!handler) {
      throw new Error(`Missing request handler for ${method}`)
    }

    return (await handler(params)) as T
  }

  respond(): void {}

  async waitForNotification(): Promise<never> {
    throw new Error("waitForNotification should not be called in this test")
  }
}

const waitForCodexTurnCompletionMock = mock(async () => ({
  id: "turn-1",
  items: [
    {
      type: "agentMessage" as const,
      id: "item-1",
      text: "Done",
      phase: null,
    },
  ],
  status: "completed",
  error: null,
}))

const mapTurnItemsToMessagesMock = mock((_turn: unknown, _threadId: string) => [])

mock.module("./codexRpcClient", () => ({
  MainCodexRpcClient: FakeMainCodexRpcClient,
}))

mock.module("node:fs/promises", () => ({
  readFile: readFileMock,
}))

mock.module("@/features/chat/runtime/codexTurnTracker", () => ({
  waitForCodexTurnCompletion: waitForCodexTurnCompletionMock,
}))

mock.module("@/features/chat/runtime/codexMessageMapper", () => ({
  mapTurnItemsToMessages: mapTurnItemsToMessagesMock,
}))

describe("CodexRuntimeProvider", () => {
  let persistence = new Map<string, any>()
  let updates: RuntimeTurnUpdateEvent[] = []

  const context = {
    emitUpdate: (
      remoteId: string,
      harnessId: RuntimeSession["harnessId"],
      result: RuntimeTurnUpdateEvent["result"]
    ) => {
      updates.push({ remoteId, harnessId, result })
    },
    persistence: {
      load: async (remoteId: string) => persistence.get(remoteId) ?? null,
      save: async (remoteId: string, metadata: any) => {
        persistence.set(remoteId, metadata)
      },
      delete: async (remoteId: string) => {
        persistence.delete(remoteId)
      },
    },
  }
  const providerSettingsService = {
    getProviderSettings: async () => ({
      enabled: true,
      binaryPath: "codex",
      homePath: "/tmp/vfactor-missing-codex-home",
      customModels: [],
    }),
  }

  beforeEach(() => {
    persistence = new Map()
    updates = []
    requestLog.length = 0
    requestHandlers.clear()
    readFileMock.mockClear()
    readFileMock.mockImplementation(async () => {
      throw new Error("missing config")
    })
    waitForCodexTurnCompletionMock.mockClear()
    mapTurnItemsToMessagesMock.mockClear()
    diagnosticListeners.clear()
  })

  test("creates a persisted Codex session shell", async () => {
    requestHandlers.set("thread/start", async () => ({
      thread: {
        id: "thread-1",
        preview: "Preview",
        createdAt: 1,
        updatedAt: 2,
        cwd: "/tmp/project",
        name: "Session",
      },
    }))

    const { CodexRuntimeProvider } = await import("./codexProvider")
    const provider = new CodexRuntimeProvider(
      context,
      fakeCodexServer as never,
      providerSettingsService as never
    )

    const session = await provider.createSession("/tmp/project")

    expect(session.harnessId).toBe("codex")
    expect(session.remoteId).toBe("thread-1")
    expect(persistence.get("thread-1")).toEqual(
      expect.objectContaining({
        harnessId: "codex",
        projectPath: "/tmp/project",
        state: {
          runtimeMode: "full-access",
        },
      })
    )
  })

  test("resumes a persisted Codex thread before the first send after restart", async () => {
    persistence.set("thread-1", {
      harnessId: "codex",
      projectPath: "/tmp/project",
      state: {
        runtimeMode: "full-access",
      },
      updatedAt: 1,
    })

    requestHandlers.set("thread/resume", async () => ({
      thread: {
        id: "thread-1",
        preview: "Preview",
        createdAt: 1,
        updatedAt: 2,
        cwd: "/tmp/project",
        name: "Session",
      },
    }))
    requestHandlers.set("turn/start", async () => ({
      turn: {
        id: "turn-1",
      },
    }))

    const { CodexRuntimeProvider } = await import("./codexProvider")
    const provider = new CodexRuntimeProvider(
      context,
      fakeCodexServer as never,
      providerSettingsService as never
    )

    await provider.sendTurn({
      session: {
        id: "draft-local",
        remoteId: "thread-1",
        harnessId: "codex",
        projectPath: "/tmp/project",
        runtimeMode: "full-access",
        createdAt: 1,
        updatedAt: 2,
      },
      projectPath: "/tmp/project",
      text: "Ping",
    })

    expect(requestLog.map((entry) => entry.method)).toEqual(["thread/resume", "turn/start"])
  })

  test("keeps sending even when best-effort Codex resume fails", async () => {
    persistence.set("thread-1", {
      harnessId: "codex",
      projectPath: "/tmp/project",
      state: {
        runtimeMode: "full-access",
      },
      updatedAt: 1,
    })

    requestHandlers.set("thread/resume", async () => {
      throw new Error("Thread not found: thread-1")
    })
    requestHandlers.set("turn/start", async () => ({
      turn: {
        id: "turn-1",
      },
    }))

    const { CodexRuntimeProvider } = await import("./codexProvider")
    const provider = new CodexRuntimeProvider(
      context,
      fakeCodexServer as never,
      providerSettingsService as never
    )

    await provider.sendTurn({
      session: {
        id: "draft-local",
        remoteId: "thread-1",
        harnessId: "codex",
        projectPath: "/tmp/project",
        runtimeMode: "full-access",
        createdAt: 1,
        updatedAt: 2,
      },
      projectPath: "/tmp/project",
      text: "Ping",
    })

    expect(requestLog.map((entry) => entry.method)).toEqual(["thread/resume", "turn/start"])
  })

  test("surfaces Codex MCP auth diagnostics as inline assistant updates", async () => {
    requestHandlers.set("turn/start", async () => ({
      turn: {
        id: "turn-1",
      },
    }))
    waitForCodexTurnCompletionMock.mockImplementationOnce(async () => {
      for (const listener of diagnosticListeners) {
        listener({
          kind: "mcp-auth",
          severity: "warning",
          message: "Codex could not authenticate one MCP connector.",
          rawMessage: "invalid_grant: Invalid refresh token",
        })
      }

      return {
        id: "turn-1",
        items: [
          {
            type: "agentMessage" as const,
            id: "item-1",
            text: "Done",
            phase: null,
          },
        ],
        status: "completed",
        error: null,
      }
    })

    const { CodexRuntimeProvider } = await import("./codexProvider")
    const provider = new CodexRuntimeProvider(
      context,
      fakeCodexServer as never,
      providerSettingsService as never
    )

    await provider.sendTurn({
      session: {
        id: "thread-1",
        remoteId: "thread-1",
        harnessId: "codex",
        projectPath: "/tmp/project",
        runtimeMode: "full-access",
        createdAt: 1,
        updatedAt: 2,
      },
      projectPath: "/tmp/project",
      text: "Ping",
    })

    const noticeUpdate = updates.find((update) =>
      update.result.messages?.some((message) =>
        message.parts.some(
          (part) =>
            part.type === "text" &&
            part.text === "Codex could not authenticate one MCP connector."
        )
      )
    )

    expect(noticeUpdate?.remoteId).toBe("thread-1")
    expect(noticeUpdate?.result.messages?.[0]?.info).toMatchObject({
      role: "assistant",
      itemType: "providerNotice",
      phase: "runtime",
      turnId: "turn-1",
    })
  })

  test("infers the newest GPT release as the default when Codex does not mark one", async () => {
    requestHandlers.set("model/list", async () => ({
      data: [
        {
          id: "gpt-5.4",
          model: "gpt-5.4",
          displayName: "GPT-5.4",
          isDefault: false,
        },
        {
          id: "gpt-5.5",
          model: "gpt-5.5",
          displayName: "GPT-5.5",
          isDefault: false,
        },
      ],
      nextCursor: null,
    }))

    const { CodexRuntimeProvider } = await import("./codexProvider")
    const provider = new CodexRuntimeProvider(context, {} as never, providerSettingsService as never)
    const models = await provider.listModels()

    expect(models[0]?.id).toBe("gpt-5.5")
    expect(models[0]?.isDefault).toBe(true)
  })

  test("includes the configured Codex model when app-server inventory lags", async () => {
    requestHandlers.set("model/list", async () => ({
      data: [
        {
          id: "gpt-5.4",
          model: "gpt-5.4",
          displayName: "GPT-5.4",
          isDefault: true,
        },
      ],
      nextCursor: null,
    }))

    const { CodexRuntimeProvider } = await import("./codexProvider")
    const provider = new CodexRuntimeProvider(context, {} as never, {
      getProviderSettings: async () => ({
        enabled: true,
        binaryPath: "codex",
        homePath: "/tmp/codex-home",
        customModels: [],
      }),
    } as never)
    readFileMock.mockResolvedValueOnce('model = "gpt-5.5"\nmodel_reasoning_effort = "medium"\n')
    const models = await provider.listModels()

    expect(models[0]?.id).toBe("gpt-5.5")
    expect(models.some((model) => model.id === "gpt-5.4")).toBe(true)
  })
})
