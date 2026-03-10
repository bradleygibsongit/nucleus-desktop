import type {
  HarnessAdapter,
  HarnessCommandInput,
  HarnessDefinition,
  HarnessTurnInput,
  HarnessTurnResult,
  MessageWithParts,
  RuntimeMessage,
  RuntimeMessagePart,
  RuntimeSession,
  RuntimeToolPart,
  RuntimeToolState,
} from "../types"
import { getCodexRpcClient } from "./codexRpcClient"

const TURN_COMPLETION_TIMEOUT_MS = 120_000
const TURN_POLL_INTERVAL_MS = 150

interface CodexThread {
  id: string
  preview: string
  createdAt: number
  updatedAt: number
  cwd: string
  name: string | null
}

interface CodexTurn {
  id: string
  items: CodexThreadItem[]
  status: string
  error: { message?: string } | null
}

type CodexThreadItem =
  | {
      type: "userMessage"
      id: string
      content: Array<{ type: "text"; text: string }>
    }
  | {
      type: "agentMessage"
      id: string
      text: string
      phase: string | null
    }
  | {
      type: "plan"
      id: string
      text: string
    }
  | {
      type: "reasoning"
      id: string
      summary: string[]
      content: string[]
    }
  | {
      type: "commandExecution"
      id: string
      command: string
      cwd: string
      processId: string | null
      status: string
      aggregatedOutput: string | null
      exitCode: number | null
      durationMs: number | null
      commandActions: unknown[]
    }
  | {
      type: "fileChange"
      id: string
      changes: unknown[]
      status: string
    }
  | {
      type: "mcpToolCall"
      id: string
      server: string
      tool: string
      status: string
      arguments: unknown
      result: unknown
      error: unknown
      durationMs: number | null
    }
  | {
      type: "dynamicToolCall"
      id: string
      tool: string
      arguments: unknown
      status: string
      contentItems: unknown[] | null
      success: boolean | null
      durationMs: number | null
    }
  | {
      type: "collabAgentToolCall"
      id: string
      tool: string
      status: string
      senderThreadId: string
      receiverThreadIds: string[]
      prompt: string | null
      agentsStates: Record<string, unknown>
    }
  | {
      type: "webSearch"
      id: string
      query: string
      action: unknown
    }
  | {
      type: "imageGeneration"
      id: string
      status: string
      revisedPrompt: string | null
      result: string
    }
  | {
      type: "imageView"
      id: string
      path: string
    }
  | {
      type: "enteredReviewMode"
      id: string
      review: string
    }
  | {
      type: "exitedReviewMode"
      id: string
      review: string
    }
  | {
      type: "contextCompaction"
      id: string
    }

interface CodexThreadReadResponse {
  thread: {
    turns: CodexTurn[]
  }
}

interface CodexTurnStartResponse {
  turn: {
    id: string
  }
}

function toMilliseconds(seconds: number): number {
  return seconds * 1000
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isTransientTurnReadError(error: unknown): boolean {
  const message = String(error)
  return (
    message.includes("is not materialized yet") ||
    message.includes("includeTurns is unavailable before first user message")
  )
}

function mapThreadToSession(thread: CodexThread): RuntimeSession {
  const title = thread.name ?? (thread.preview || undefined)

  return {
    id: thread.id,
    harnessId: "codex",
    title,
    projectPath: thread.cwd,
    createdAt: toMilliseconds(thread.createdAt),
    updatedAt: toMilliseconds(thread.updatedAt),
  }
}

function mapCodexStatus(status: string | null | undefined): RuntimeToolState["status"] {
  const normalized = String(status ?? "").toLowerCase()

  if (
    normalized === "pending" ||
    normalized === "queued" ||
    normalized === "inprogress" ||
    normalized === "in_progress" ||
    normalized === "running" ||
    normalized === "active"
  ) {
    return "running"
  }

  if (
    normalized.includes("error") ||
    normalized.includes("fail") ||
    normalized.includes("reject")
  ) {
    return "error"
  }

  if (!normalized) {
    return "completed"
  }

  return "completed"
}

function createAssistantMessage(
  sessionId: string,
  itemId: string,
  createdAt: number,
  parts: RuntimeMessagePart[],
  finishReason?: RuntimeMessage["finishReason"]
): MessageWithParts {
  return {
    info: {
      id: `${itemId}:message`,
      sessionId,
      role: "assistant",
      createdAt,
      finishReason,
    },
    parts,
  }
}

function createToolMessage(
  sessionId: string,
  itemId: string,
  createdAt: number,
  tool: string,
  state: RuntimeToolState
): MessageWithParts {
  return createAssistantMessage(sessionId, itemId, createdAt, [
    {
      id: itemId,
      type: "tool",
      messageId: `${itemId}:message`,
      sessionId,
      tool,
      state,
    } satisfies RuntimeToolPart,
  ])
}

function mapTurnItemsToMessages(turn: CodexTurn, sessionId: string): MessageWithParts[] {
  const baseCreatedAt = Date.now()

  return turn.items.flatMap((item, index) => {
    const createdAt = baseCreatedAt + index

    switch (item.type) {
      case "userMessage":
        return []

      case "agentMessage":
        return [
          createAssistantMessage(
            sessionId,
            item.id,
            createdAt,
            [
              {
                id: `${item.id}:text`,
                type: "text",
                text: item.text,
              },
            ],
            item.phase === "final_answer" ? "end_turn" : undefined
          ),
        ]

      case "plan":
        return [
          createAssistantMessage(sessionId, item.id, createdAt, [
            {
              id: `${item.id}:text`,
              type: "text",
              text: item.text,
            },
          ]),
        ]

      case "reasoning":
        return [
          createAssistantMessage(sessionId, item.id, createdAt, [
            {
              id: `${item.id}:text`,
              type: "text",
              text: [...item.summary, ...item.content].join("\n\n"),
            },
          ]),
        ]

      case "commandExecution":
        return [
          createToolMessage(sessionId, item.id, createdAt, "command/exec", {
            status: mapCodexStatus(item.status),
            title: item.command,
            input: {
              command: item.command,
              cwd: item.cwd,
              processId: item.processId,
              commandActions: item.commandActions,
            },
            output: {
              aggregatedOutput: item.aggregatedOutput,
              exitCode: item.exitCode,
              durationMs: item.durationMs,
            },
          }),
        ]

      case "fileChange":
        return [
          createToolMessage(sessionId, item.id, createdAt, "fileChange", {
            status: mapCodexStatus(item.status),
            title: "Apply file changes",
            input: {
              changes: item.changes,
            },
            output: {
              changes: item.changes,
            },
          }),
        ]

      case "mcpToolCall":
        return [
          createToolMessage(sessionId, item.id, createdAt, `${item.server}/${item.tool}`, {
            status: mapCodexStatus(item.status),
            title: `${item.server}:${item.tool}`,
            input: {
              arguments: item.arguments,
            },
            output: item.result,
            error: item.error,
          }),
        ]

      case "dynamicToolCall":
        return [
          createToolMessage(sessionId, item.id, createdAt, item.tool, {
            status: mapCodexStatus(item.status),
            title: item.tool,
            input: {
              arguments: item.arguments,
            },
            output: {
              contentItems: item.contentItems,
              success: item.success,
              durationMs: item.durationMs,
            },
          }),
        ]

      case "collabAgentToolCall":
        return [
          createToolMessage(sessionId, item.id, createdAt, `collab/${item.tool}`, {
            status: mapCodexStatus(item.status),
            title: item.tool,
            input: {
              senderThreadId: item.senderThreadId,
              receiverThreadIds: item.receiverThreadIds,
              prompt: item.prompt,
            },
            output: item.agentsStates,
          }),
        ]

      case "webSearch":
        return [
          createToolMessage(sessionId, item.id, createdAt, "webSearch", {
            status: "completed",
            title: item.query,
            input: {
              query: item.query,
            },
            output: item.action,
          }),
        ]

      case "imageGeneration":
        return [
          createToolMessage(sessionId, item.id, createdAt, "imageGeneration", {
            status: mapCodexStatus(item.status),
            title: "Generate image",
            input: {
              revisedPrompt: item.revisedPrompt,
            },
            output: item.result,
          }),
        ]

      case "imageView":
        return [
          createToolMessage(sessionId, item.id, createdAt, "imageView", {
            status: "completed",
            title: item.path,
            input: {
              path: item.path,
            },
            output: null,
          }),
        ]

      case "enteredReviewMode":
      case "exitedReviewMode":
        return [
          createAssistantMessage(sessionId, item.id, createdAt, [
            {
              id: `${item.id}:text`,
              type: "text",
              text: item.review,
            },
          ]),
        ]

      case "contextCompaction":
        return [
          createToolMessage(sessionId, item.id, createdAt, "contextCompaction", {
            status: "completed",
            title: "Compact context",
            input: {},
            output: null,
          }),
        ]

      default:
        return []
    }
  })
}

export class CodexHarnessAdapter implements HarnessAdapter {
  private rpc = getCodexRpcClient()
  private activeTurns = new Map<string, string>()

  constructor(public definition: HarnessDefinition) {}

  async initialize(): Promise<void> {
    await this.rpc.connect()
  }

  async createSession(projectPath: string): Promise<RuntimeSession> {
    await this.initialize()

    const response = await this.rpc.request<{
      thread: CodexThread
    }>("thread/start", {
      cwd: projectPath,
      approvalPolicy: "never",
      sandbox: "workspace-write",
      experimentalRawEvents: false,
      persistExtendedHistory: false,
    })

    return mapThreadToSession(response.thread)
  }

  async listAgents() {
    return []
  }

  async listCommands() {
    return []
  }

  async searchFiles() {
    return []
  }

  async sendMessage(input: HarnessTurnInput): Promise<HarnessTurnResult> {
    const response = await this.rpc.request<CodexTurnStartResponse>("turn/start", {
      threadId: input.session.id,
      cwd: input.projectPath ?? input.session.projectPath ?? null,
      input: [
        {
          type: "text",
          text: input.text,
          text_elements: [],
        },
      ],
    })

    const turnId = response.turn.id
    this.activeTurns.set(input.session.id, turnId)

    const completedTurn = await this.waitForTurnCompletion(
      input.session.id,
      turnId,
      input.onUpdate
    )
    this.activeTurns.delete(input.session.id)

    if (completedTurn?.status === "failed" && completedTurn.error?.message) {
      throw new Error(completedTurn.error.message)
    }

    const turn = completedTurn ?? (await this.readTurn(input.session.id, turnId))

    if (!turn) {
      return { messages: [] }
    }

    return {
      messages: mapTurnItemsToMessages(turn, input.session.id),
    }
  }

  async executeCommand(input: HarnessCommandInput): Promise<HarnessTurnResult> {
    const now = Date.now()

    return {
      messages: [
        createAssistantMessage(
          input.session.id,
          `command:${now}`,
          now,
          [
            {
              id: `command:${now}:text`,
              type: "text",
              text: `Command execution through the Codex adapter is not wired up yet. Requested command: /${input.command}${input.args ? ` ${input.args}` : ""}`,
            },
          ]
        ),
      ],
    }
  }

  async abortSession(session: RuntimeSession): Promise<void> {
    const turnId = this.activeTurns.get(session.id)
    if (!turnId) {
      return
    }

    await this.rpc.request("turn/interrupt", {
      threadId: session.id,
      turnId,
    })
    this.activeTurns.delete(session.id)
  }

  private async waitForTurnCompletion(
    threadId: string,
    turnId: string,
    onUpdate?: HarnessTurnInput["onUpdate"]
  ): Promise<CodexTurn | undefined> {
    return this.pollTurnUntilComplete(threadId, turnId, onUpdate)
  }

  private async pollTurnUntilComplete(
    threadId: string,
    turnId: string,
    onUpdate?: HarnessTurnInput["onUpdate"]
  ): Promise<CodexTurn> {
    const deadline = Date.now() + TURN_COMPLETION_TIMEOUT_MS
    let lastSnapshot = ""

    while (Date.now() < deadline) {
      try {
        const turn = await this.readTurn(threadId, turnId)

        if (turn) {
          const snapshot = JSON.stringify(turn.items)

          if (snapshot !== lastSnapshot) {
            lastSnapshot = snapshot
            onUpdate?.({
              messages: mapTurnItemsToMessages(turn, threadId),
            })
          }
        }

        if (turn && turn.status !== "inProgress") {
          return turn
        }
      } catch (error) {
        if (!isTransientTurnReadError(error)) {
          throw error
        }
      }

      await sleep(TURN_POLL_INTERVAL_MS)
    }

    throw new Error("Timed out waiting for Codex turn completion")
  }

  private async readTurn(threadId: string, turnId: string): Promise<CodexTurn | undefined> {
    const readResponse = await this.rpc.request<CodexThreadReadResponse>("thread/read", {
      threadId,
      includeTurns: true,
    })

    return readResponse.thread.turns.find((candidate) => candidate.id === turnId)
  }
}
