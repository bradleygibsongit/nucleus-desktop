import {
  DEFAULT_RUNTIME_MODE,
  type HarnessPromptInput,
  type HarnessTurnInput,
  type HarnessTurnResult,
  type RuntimeFileSearchResult,
  type RuntimeModel,
  type RuntimeModeKind,
  type RuntimePrompt,
  type RuntimeSession,
} from "@/features/chat/types"
import { getRuntimeModelLabel } from "@/features/chat/domain/runtimeModels"
import { getRemoteSessionId } from "@/features/chat/domain/runtimeSessions"
import { mapTurnItemsToMessages } from "@/features/chat/runtime/codexMessageMapper"
import {
  mapReasoningEffort,
  mapThreadToSession,
  readCodexTurn,
  TURN_SYNC_INTERVAL_MS,
  type CodexModel,
  type CodexModelListResponse,
  type CodexServerRequestResolvedNotification,
  type CodexThread,
  type CodexTurn,
  type CodexTurnStartResponse,
} from "@/features/chat/runtime/codexProtocol"
import {
  codexModelSupportsFastMode,
  mapCodexFastModeToServiceTier,
} from "@/features/chat/runtime/codexFastMode"
import {
  logCodexApprovalDebug,
  mapApprovalDecisionToClientRequest,
  mapApprovalDecisionToServerResponse,
  mapApprovalPromptToApplyPatchApprovalParams,
  mapApprovalPromptToExecCommandApprovalParams,
  mapRuntimePromptResponseToCodexResponse,
  type CodexPendingApprovalRequest,
  type CodexPendingUserInputRequest,
} from "@/features/chat/runtime/codexPrompts"
import { waitForCodexTurnCompletion } from "@/features/chat/runtime/codexTurnTracker"
import type { CodexServerService } from "../codexServer"
import { MainCodexRpcClient } from "./codexRpcClient"
import type { RuntimeProviderAdapter, RuntimeProviderContext } from "./providerTypes"

type CodexSessionPermissionPreset = {
  approvalPolicy: "unlessTrusted" | "on-request" | "never"
  sandbox: "read-only" | "workspace-write" | "danger-full-access"
}

type CodexTurnSandboxPolicy =
  | { type: "readOnly" }
  | { type: "workspaceWrite" }
  | { type: "dangerFullAccess" }

const CODEX_REASONING_SUMMARY = "detailed" as const
const CODEX_MODEL_CACHE_TTL_MS = 30 * 60 * 1000
const CODEX_REASONING_SUMMARY_PARAM = "reasoning.summary"

function extractErrorText(error: unknown): string {
  if (typeof error === "string") {
    return error
  }

  if (error instanceof Error) {
    return error.message
  }

  if (error && typeof error === "object") {
    try {
      return JSON.stringify(error)
    } catch {
      return String(error)
    }
  }

  return String(error)
}

function isUnsupportedReasoningSummaryError(error: unknown): boolean {
  const rawMessage = extractErrorText(error)
  const candidates = [rawMessage]

  try {
    const parsed = JSON.parse(rawMessage) as {
      error?: {
        code?: string
        message?: string
        param?: string
      }
    }
    candidates.push(
      parsed.error?.message ?? "",
      parsed.error?.code ?? "",
      parsed.error?.param ?? ""
    )
  } catch {}

  const message = candidates.join("\n")
  return (
    message.includes(CODEX_REASONING_SUMMARY_PARAM) &&
    (message.includes("unsupported_parameter") || message.includes("Unsupported parameter"))
  )
}

function getCodexSessionPermissionPreset(
  runtimeMode: RuntimeModeKind
): CodexSessionPermissionPreset {
  switch (runtimeMode) {
    case "approval-required":
      return {
        approvalPolicy: "unlessTrusted",
        sandbox: "read-only",
      }
    case "auto-accept-edits":
      return {
        approvalPolicy: "on-request",
        sandbox: "workspace-write",
      }
    case "full-access":
    default:
      return {
        approvalPolicy: "never",
        sandbox: "danger-full-access",
      }
  }
}

function getCodexTurnSandboxPolicy(runtimeMode: RuntimeModeKind): CodexTurnSandboxPolicy {
  switch (runtimeMode) {
    case "approval-required":
      return { type: "readOnly" }
    case "auto-accept-edits":
      return { type: "workspaceWrite" }
    case "full-access":
    default:
      return { type: "dangerFullAccess" }
  }
}

export class CodexRuntimeProvider implements RuntimeProviderAdapter {
  readonly harnessId = "codex" as const

  private rpc: MainCodexRpcClient
  private activeTurns = new Map<string, string>()
  private knownThreads = new Set<string>()
  private pendingUserInputRequests = new Map<string, CodexPendingUserInputRequest>()
  private pendingApprovalRequests = new Map<string, CodexPendingApprovalRequest>()
  private pendingApprovalNotificationPrompts = new Map<string, RuntimePrompt>()
  private modelCache: { models: RuntimeModel[]; fetchedAt: number } | null = null
  private modelRequest: Promise<RuntimeModel[]> | null = null
  private modelsWithoutReasoningSummary = new Set<string>()
  private defaultModelSupportsReasoningSummary = true

  constructor(
    private readonly context: RuntimeProviderContext,
    codexServerService: CodexServerService
  ) {
    this.rpc = new MainCodexRpcClient(codexServerService)
  }

  async createSession(
    projectPath: string,
    options?: { runtimeMode?: RuntimeModeKind }
  ): Promise<RuntimeSession> {
    const runtimeMode = options?.runtimeMode ?? DEFAULT_RUNTIME_MODE
    const response = await this.openThread({
      projectPath,
      runtimeMode,
    })
    const session = mapThreadToSession(response.thread)
    const remoteId = getRemoteSessionId(session)

    this.knownThreads.add(remoteId)
    await this.persistSession(remoteId, projectPath, runtimeMode)

    return session
  }

  async listAgents() {
    return []
  }

  async listCommands(_projectPath?: string) {
    return []
  }

  async listModels(): Promise<RuntimeModel[]> {
    if (this.modelCache && Date.now() - this.modelCache.fetchedAt < CODEX_MODEL_CACHE_TTL_MS) {
      return this.modelCache.models
    }

    if (this.modelRequest) {
      return this.modelRequest
    }

    this.modelRequest = this.loadModelsFromRpc()

    try {
      const models = await this.modelRequest
      this.modelCache = {
        models,
        fetchedAt: Date.now(),
      }
      return models
    } finally {
      this.modelRequest = null
    }
  }

  async searchFiles(_query: string, _directory?: string): Promise<RuntimeFileSearchResult[]> {
    return []
  }

  private async loadModelsFromRpc(): Promise<RuntimeModel[]> {
    await this.rpc.connect()

    const models: RuntimeModel[] = []
    let cursor: string | null = null

    do {
      const params: { limit: number; includeHidden: boolean; cursor?: string } = {
        limit: 100,
        includeHidden: false,
      }

      if (cursor) {
        params.cursor = cursor
      }

      const response: CodexModelListResponse = await this.rpc.request("model/list", params)

      models.push(
        ...response.data.map((model: CodexModel) => ({
          id: model.id || model.model,
          displayName: getRuntimeModelLabel({
            displayName: model.displayName,
            id: model.model || model.id,
          }),
          isDefault: model.isDefault ?? false,
          defaultReasoningEffort: model.defaultReasoningEffort ?? null,
          supportedReasoningEfforts:
            model.supportedReasoningEfforts
              ?.map((entry: { reasoningEffort: string }) => entry.reasoningEffort)
              .filter((value: string): value is string => value.length > 0) ?? [],
          supportsFastMode: codexModelSupportsFastMode(model.id || model.model),
        }))
      )

      cursor = response.nextCursor
    } while (cursor)

    return Array.from(new Map(models.map((model) => [model.id, model])).values()).sort(
      (left, right) => {
        if (left.isDefault !== right.isDefault) {
          return left.isDefault ? -1 : 1
        }

        return left.displayName.localeCompare(right.displayName)
      }
    )
  }

  async sendTurn(input: HarnessTurnInput): Promise<HarnessTurnResult> {
    const threadId = getRemoteSessionId(input.session)
    await this.ensureThreadReady(input, threadId)

    const requestedModel = input.model?.trim() || null
    const shouldIncludeReasoningSummary = requestedModel
      ? !this.modelsWithoutReasoningSummary.has(requestedModel)
      : this.defaultModelSupportsReasoningSummary

    let response: CodexTurnStartResponse

    try {
      response = await this.startTurn(input, threadId, shouldIncludeReasoningSummary)
    } catch (error) {
      if (!shouldIncludeReasoningSummary || !isUnsupportedReasoningSummaryError(error)) {
        throw error
      }

      if (requestedModel) {
        this.modelsWithoutReasoningSummary.add(requestedModel)
      } else {
        this.defaultModelSupportsReasoningSummary = false
      }

      response = await this.startTurn(input, threadId, false)
    }

    const turnId = response.turn.id
    this.activeTurns.set(threadId, turnId)
    input.onUpdate?.({})

    const completedTurn = await waitForCodexTurnCompletion({
      rpc: this.rpc as any,
      threadId,
      sessionId: threadId,
      turnId,
      onUpdate: (result) => {
        input.onUpdate?.(result)
        this.context.emitUpdate(threadId, this.harnessId, result)
      },
      pendingUserInputRequests: this.pendingUserInputRequests,
      pendingApprovalRequests: this.pendingApprovalRequests,
      pendingApprovalNotificationPrompts: this.pendingApprovalNotificationPrompts,
    })
    this.activeTurns.delete(threadId)

    if (completedTurn?.status === "failed" && completedTurn.error?.message) {
      throw new Error(completedTurn.error.message)
    }

    const turn =
      completedTurn && completedTurn.items.length > 0
        ? completedTurn
        : (await this.readTurn(threadId, turnId)) ?? completedTurn

    if (!turn) {
      return { messages: [] }
    }

    return {
      messages: mapTurnItemsToMessages(turn, threadId),
    }
  }

  private startTurn(
    input: HarnessTurnInput,
    threadId: string,
    includeReasoningSummary: boolean
  ): Promise<CodexTurnStartResponse> {
    const runtimeMode = input.runtimeMode ?? input.session.runtimeMode ?? DEFAULT_RUNTIME_MODE
    const permissionPreset = getCodexSessionPermissionPreset(runtimeMode)

    return this.rpc.request<CodexTurnStartResponse>("turn/start", {
      threadId,
      cwd: input.projectPath ?? input.session.projectPath ?? null,
      approvalPolicy: permissionPreset.approvalPolicy,
      sandboxPolicy: getCodexTurnSandboxPolicy(runtimeMode),
      model: input.model ?? null,
      effort: mapReasoningEffort(input.reasoningEffort),
      serviceTier: mapCodexFastModeToServiceTier(input.fastMode),
      ...(includeReasoningSummary ? { summary: CODEX_REASONING_SUMMARY } : {}),
      collaborationMode: input.collaborationMode
        ? {
            mode: input.collaborationMode,
            settings: {
              model: input.model ?? "gpt-5.4",
              reasoning_effort: mapReasoningEffort(input.reasoningEffort),
              developer_instructions: null,
            },
          }
        : null,
      input: [
        {
          type: "text",
          text: input.text,
          text_elements: [],
        },
      ],
    })
  }

  private async openThread(input: {
    projectPath: string
    runtimeMode: RuntimeModeKind
    resumeThreadId?: string
  }): Promise<{ thread: CodexThread }> {
    await this.rpc.connect()

    const permissionPreset = getCodexSessionPermissionPreset(input.runtimeMode)
    const params = {
      cwd: input.projectPath,
      approvalPolicy: permissionPreset.approvalPolicy,
      sandbox: permissionPreset.sandbox,
      experimentalRawEvents: false,
      persistExtendedHistory: false,
    }

    if (input.resumeThreadId) {
      return this.rpc.request<{ thread: CodexThread }>("thread/resume", {
        threadId: input.resumeThreadId,
        ...params,
      })
    }

    return this.rpc.request<{ thread: CodexThread }>("thread/start", params)
  }

  private async ensureThreadReady(input: HarnessTurnInput, threadId: string): Promise<void> {
    if (this.knownThreads.has(threadId)) {
      return
    }

    const persisted = await this.context.persistence.load(threadId)
    const persistedState =
      persisted?.harnessId === this.harnessId && persisted.state && typeof persisted.state === "object"
        ? (persisted.state as { runtimeMode?: RuntimeModeKind | null })
        : null
    const projectPath = input.projectPath ?? input.session.projectPath ?? persisted?.projectPath ?? ""
    const runtimeMode =
      input.runtimeMode ??
      input.session.runtimeMode ??
      persistedState?.runtimeMode ??
      DEFAULT_RUNTIME_MODE

    if (!projectPath) {
      return
    }

    try {
      const resumed = await this.openThread({
        projectPath,
        runtimeMode,
        resumeThreadId: threadId,
      })
      const resumedThreadId = resumed.thread.id || threadId
      this.knownThreads.add(threadId)
      this.knownThreads.add(resumedThreadId)
      await this.persistSession(resumedThreadId, projectPath, runtimeMode)
    } catch (error) {
      console.warn("[codexProvider] Failed to resume thread before send; continuing without recovery.", {
        threadId,
        error: extractErrorText(error),
      })
    }
  }

  private async persistSession(
    remoteId: string,
    projectPath: string,
    runtimeMode: RuntimeModeKind
  ): Promise<void> {
    await this.context.persistence.save(remoteId, {
      harnessId: this.harnessId,
      projectPath,
      state: {
        runtimeMode,
      },
      updatedAt: Date.now(),
    })
  }

  async answerPrompt(input: HarnessPromptInput): Promise<HarnessTurnResult> {
    const remoteId = getRemoteSessionId(input.session)
    const pendingRequest = this.pendingUserInputRequests.get(remoteId)
    if (pendingRequest && pendingRequest.prompt.id === input.prompt.id) {
      if (input.prompt.kind !== "question" || input.response.kind !== "question") {
        throw new Error("Question prompt responses must use the structured question answer shape")
      }

      this.rpc.respond(
        pendingRequest.requestId,
        mapRuntimePromptResponseToCodexResponse(input.prompt, input.response)
      )

      try {
        await this.rpc.waitForNotification<CodexServerRequestResolvedNotification>(
          (notification) =>
            notification.method === "serverRequest/resolved" &&
            notification.params?.threadId === pendingRequest.threadId &&
            notification.params?.requestId === pendingRequest.requestId,
          TURN_SYNC_INTERVAL_MS * 8
        )
      } catch {}

      this.pendingUserInputRequests.delete(remoteId)
      return {}
    }

    const pendingApprovalRequest = this.pendingApprovalRequests.get(remoteId)
    if (pendingApprovalRequest && pendingApprovalRequest.prompt.id === input.prompt.id) {
      logCodexApprovalDebug("answer:start", {
        sessionId: remoteId,
        promptId: input.prompt.id,
        protocol: pendingApprovalRequest.protocol,
        requestId: pendingApprovalRequest.requestId ?? null,
        callId: pendingApprovalRequest.callId,
      })

      if (pendingApprovalRequest.protocol === "v2ServerRequest") {
        if (pendingApprovalRequest.requestId == null) {
          throw new Error("Approval server request is missing a request id.")
        }

        this.rpc.respond(
          pendingApprovalRequest.requestId,
          mapApprovalDecisionToServerResponse(input.prompt, input.response)
        )
      } else if (pendingApprovalRequest.protocol === "v1ServerRequest") {
        if (pendingApprovalRequest.requestId == null) {
          throw new Error("Approval server request is missing a request id.")
        }

        this.rpc.respond(
          pendingApprovalRequest.requestId,
          mapApprovalDecisionToClientRequest(input.prompt, input.response)
        )
      } else {
        const method =
          pendingApprovalRequest.requestMethod ??
          (input.prompt.kind === "approval" && input.prompt.approval.kind === "fileChange"
            ? "applyPatchApproval"
            : "execCommandApproval")
        const params =
          method === "applyPatchApproval"
            ? mapApprovalPromptToApplyPatchApprovalParams(input.prompt)
            : mapApprovalPromptToExecCommandApprovalParams(input.prompt)

        await this.rpc.request(method, {
          ...params,
          ...mapApprovalDecisionToClientRequest(input.prompt, input.response),
        })
      }

      this.pendingApprovalRequests.delete(remoteId)
      this.pendingApprovalNotificationPrompts.delete(remoteId)
      return {}
    }

    if (input.prompt.kind === "approval") {
      throw new Error("Approval request is no longer pending.")
    }

    return this.sendTurn({
      session: input.session,
      projectPath: input.projectPath,
      text: input.response.text,
    })
  }

  async interruptTurn(session: RuntimeSession): Promise<void> {
    const threadId = getRemoteSessionId(session)
    const turnId = this.activeTurns.get(threadId)
    if (!turnId) {
      return
    }

    await this.rpc.request("turn/interrupt", {
      threadId,
      turnId,
    })
    this.activeTurns.delete(threadId)
  }

  getActiveTurnCount(): number {
    return this.activeTurns.size
  }

  dispose(): void {
    this.knownThreads.clear()
  }

  private async readTurn(threadId: string, turnId: string): Promise<CodexTurn | undefined> {
    try {
      return await readCodexTurn(this.rpc as any, threadId, turnId)
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : `Thread not found: ${threadId}`
      )
    }
  }
}
