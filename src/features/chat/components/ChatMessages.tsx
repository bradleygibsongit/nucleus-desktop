import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import type { Project } from "@/features/workspace/types"
import type { ChildSessionState, MessageWithParts, RuntimePrompt } from "../types"
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "./ai-elements/conversation"
import {
  Message as MessageComponent,
  MessageContent,
} from "./ai-elements/message"
import type { ChildSessionData } from "./agent-activity/AgentActivitySubagent"
import { Shaka } from "@/components/icons"
import { LoadingDots } from "@/features/shared/components/ui/loading-dots"
import { useStickToBottomContext } from "use-stick-to-bottom"
import { isRuntimeApprovalPrompt } from "../domain/runtimePrompts"
import { ChatTimelineItem, InlineSubagentActivity } from "./ChatTimelineItem"
import { formatElapsedDuration, useElapsedDuration } from "./workDuration"
import {
  buildTimelineBlocks,
  getFileChangeEntries,
  getToolPartFromMessage,
} from "./timelineActivity"

interface ChatMessagesProps {
  threadKey: string
  messages: MessageWithParts[]
  status: "idle" | "streaming" | "error"
  activePrompt?: RuntimePrompt | null
  selectedProject?: Project | null
  childSessions?: Map<string, ChildSessionState>
  showInlineIntro?: boolean
}

function StaticConversation({
  children,
  resetKey,
}: {
  children: ReactNode
  resetKey: string
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [resetKey])

  return (
    <div
      ref={scrollRef}
      className="app-scrollbar h-full overflow-y-auto overscroll-none"
    >
      {children}
    </div>
  )
}

interface ChatEmptyStateProps {
  selectedProject?: Project | null
}

function countDiffLines(diff: string | undefined): { added: number; removed: number } {
  if (!diff) {
    return { added: 0, removed: 0 }
  }

  return diff.split("\n").reduce(
    (totals, line) => {
      if (line.startsWith("+++ ") || line.startsWith("--- ")) {
        return totals
      }
      if (line.startsWith("+")) {
        return { ...totals, added: totals.added + 1 }
      }
      if (line.startsWith("-")) {
        return { ...totals, removed: totals.removed + 1 }
      }
      return totals
    },
    { added: 0, removed: 0 }
  )
}

function ChatEmptyState({ selectedProject }: ChatEmptyStateProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <Shaka size={48} className="text-primary" />

        <h2
          className="bg-gradient-to-b from-foreground to-muted-foreground bg-clip-text text-2xl font-extrabold tracking-tight text-transparent"
        >
          Build cool sh*t
        </h2>

        {selectedProject ? (
          <div className="flex flex-col items-center gap-1 text-center">
            <span className="max-w-[320px] truncate text-[13px] font-medium leading-snug text-muted-foreground">
              {selectedProject.name}
            </span>
            {selectedProject.path ? (
              <span className="max-w-[360px] truncate text-[12px] leading-snug text-muted-foreground/40">
                {selectedProject.path}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}


export function ChatMessages({
  threadKey,
  messages,
  status,
  activePrompt = null,
  selectedProject: _selectedProject,
  childSessions,
  showInlineIntro = false,
}: ChatMessagesProps) {
  const approvalTimelineMessage = useMemo(() => {
    if (!isRuntimeApprovalPrompt(activePrompt)) {
      return null
    }

    const itemType =
      activePrompt.approval.kind === "fileChange" ? "fileChange" : "commandExecution"
    const messageId = activePrompt.approval.itemId
      ? `approval:${activePrompt.approval.itemId}`
      : `approval:${activePrompt.id}`

    return {
      info: {
        id: messageId,
        sessionId: messageId,
        role: "assistant" as const,
        createdAt: Date.now(),
        turnId: activePrompt.approval.turnId,
        itemType,
      },
      parts: [
        {
          id: `${messageId}:tool`,
          type: "tool" as const,
          messageId,
          sessionId: messageId,
          tool: itemType === "fileChange" ? "fileChange" : "command/exec",
          state: {
            status: "pending" as const,
            title:
              itemType === "fileChange"
                ? "Apply file changes"
                : activePrompt.approval.command ?? "Run command",
            subtitle: activePrompt.approval.cwd,
            input:
              itemType === "fileChange"
                ? {
                    reason: activePrompt.approval.reason,
                  }
                : {
                    command: activePrompt.approval.command,
                    cwd: activePrompt.approval.cwd,
                    commandActions: activePrompt.approval.commandActions,
                  },
            output:
              itemType === "fileChange"
                ? {
                    changes: activePrompt.approval.changes ?? [],
                    outputText: null,
                  }
                : undefined,
          },
        },
      ],
    }
  }, [activePrompt])
  const renderedMessages = useMemo(
    () => (approvalTimelineMessage ? [...messages, approvalTimelineMessage] : messages),
    [approvalTimelineMessage, messages]
  )
  const timelineBlocks = useMemo(
    () => buildTimelineBlocks(renderedMessages),
    [renderedMessages]
  )
  const hasContent = renderedMessages.length > 0
  const lastMessage = renderedMessages[renderedMessages.length - 1]
  const shouldRenderStreamingPlaceholder =
    status === "streaming" && !activePrompt && (!lastMessage || lastMessage.info.role === "user")
  const [activeWorkStartTime, setActiveWorkStartTime] = useState<number | null>(null)
  const [lastCompletedWork, setLastCompletedWork] = useState<{
    messageId: string
    durationMs: number
  } | null>(null)
  const previousStatusRef = useRef(status)
  const lastAssistantTextMessageId = useMemo(
    () =>
      [...renderedMessages]
        .reverse()
        .find(
          (message) =>
            message.info.role === "assistant" &&
            message.parts.some((part) => part.type === "text" && part.text.trim())
        )?.info.id ?? null,
    [renderedMessages]
  )
  const changedFilesSummaryByMessageId = useMemo(() => {
    const summaryByMessageId = new Map<
      string,
      { fileCount: number; label: string; added: number; removed: number }
    >()

    if (!lastAssistantTextMessageId) {
      return summaryByMessageId
    }

    // Find the last user message to scope changes to the latest turn
    let lastUserIndex = -1
    for (let i = renderedMessages.length - 1; i >= 0; i--) {
      if (renderedMessages[i].info.role === "user") {
        lastUserIndex = i
        break
      }
    }

    // Collect file changes between the last user message and end of thread
    const changeTotals = new Map<string, { added: number; removed: number }>()
    const startIndex = lastUserIndex + 1

    for (let i = startIndex; i < renderedMessages.length; i++) {
      const candidate = renderedMessages[i]
      if (candidate.info.itemType !== "fileChange") {
        continue
      }

      const toolPart = getToolPartFromMessage(candidate)
      const output = toolPart?.state.output
      const source =
        output && typeof output === "object" && "changes" in output
          ? (output as { changes?: unknown[] }).changes
          : undefined
      const fileChanges = getFileChangeEntries(source)

      for (const change of fileChanges) {
        const current = changeTotals.get(change.path) ?? { added: 0, removed: 0 }
        const diffTotals = countDiffLines(change.diff)

        changeTotals.set(change.path, {
          added: current.added + diffTotals.added,
          removed: current.removed + diffTotals.removed,
        })
      }
    }

    if (changeTotals.size === 0) {
      return summaryByMessageId
    }

    const entries = Array.from(changeTotals.entries())
    const [firstPath] = entries[0]
    const totalAdded = entries.reduce((sum, [, totals]) => sum + totals.added, 0)
    const totalRemoved = entries.reduce((sum, [, totals]) => sum + totals.removed, 0)

    summaryByMessageId.set(lastAssistantTextMessageId, {
      fileCount: entries.length,
      label:
        entries.length === 1
          ? firstPath.split(/[\\/]/).filter(Boolean).at(-1) ?? firstPath
          : `${entries.length} files`,
      added: totalAdded,
      removed: totalRemoved,
    })

    return summaryByMessageId
  }, [lastAssistantTextMessageId, renderedMessages])
  const completedWorkDurationByMessageId = useMemo(() => {
    const earliestTimestampByTurnId = new Map<string, number>()
    const durationByMessageId = new Map<string, number>()

    for (const message of renderedMessages) {
      const turnId = message.info.turnId
      if (!turnId) {
        continue
      }

      const existingTimestamp = earliestTimestampByTurnId.get(turnId)
      const nextTimestamp =
        existingTimestamp == null
          ? message.info.createdAt
          : Math.min(existingTimestamp, message.info.createdAt)
      earliestTimestampByTurnId.set(turnId, nextTimestamp)
    }

    for (const message of renderedMessages) {
      if (message.info.role !== "assistant") {
        continue
      }

      const hasText = message.parts.some((part) => part.type === "text" && part.text.trim())
      if (!hasText) {
        continue
      }

      const turnId = message.info.turnId
      if (!turnId) {
        continue
      }

      const startTime = earliestTimestampByTurnId.get(turnId)
      if (startTime == null) {
        continue
      }

      durationByMessageId.set(message.info.id, Math.max(0, message.info.createdAt - startTime))
    }

    return durationByMessageId
  }, [renderedMessages])

  useEffect(() => {
    const previousStatus = previousStatusRef.current

    if (previousStatus !== "streaming" && status === "streaming") {
      setActiveWorkStartTime(Date.now())
      setLastCompletedWork(null)
    }

    if (previousStatus === "streaming" && status !== "streaming" && activeWorkStartTime != null) {
      const lastAssistantMessage = [...renderedMessages]
        .reverse()
        .find(
          (message) =>
            message.info.role === "assistant" &&
            message.parts.some((part) => part.type === "text" && part.text.trim())
        )

      if (lastAssistantMessage) {
        setLastCompletedWork({
          messageId: lastAssistantMessage.info.id,
          durationMs: Date.now() - activeWorkStartTime,
        })
      }

      setActiveWorkStartTime(null)
    }

    previousStatusRef.current = status
  }, [activeWorkStartTime, renderedMessages, status])

  // Convert ChildSessionState to ChildSessionData for the component
  const childSessionData: Map<string, ChildSessionData> | undefined = childSessions 
    ? new Map(
        Array.from(childSessions.entries()).map(([id, state]) => [
          id,
          {
            session: state.session,
            toolParts: state.toolParts,
            isActive: state.isActive,
          },
        ])
      )
    : undefined
  const hasCollabTimelineItem = useMemo(
    () => messages.some((message) => message.info.itemType === "collabAgentToolCall"),
    [messages]
  )
  const orphanChildSessions = useMemo(() => {
    if (!childSessionData || childSessionData.size === 0 || hasCollabTimelineItem) {
      return []
    }

    return Array.from(childSessionData.values())
  }, [childSessionData, hasCollabTimelineItem])
  const [preparedThreadKey, setPreparedThreadKey] = useState(threadKey)
  const isThreadPrepared = preparedThreadKey === threadKey

  if (!hasContent) {
    if (!showInlineIntro) {
      return (
        <StaticConversation resetKey={_selectedProject?.id ?? "empty-chat"}>
          <div className="min-h-full" />
        </StaticConversation>
      )
    }

    return (
      <StaticConversation resetKey={_selectedProject?.id ?? "empty-chat"}>
        <div className="flex min-h-full w-full items-center justify-center">
          <ChatEmptyState key={_selectedProject?.id ?? "empty-chat"} selectedProject={_selectedProject} />
        </div>
      </StaticConversation>
    )
  }

  return (
    <Conversation
      key={threadKey}
      className={isThreadPrepared ? "h-full" : "h-full invisible"}
    >
      <ChatAutoScroll
        threadKey={threadKey}
        messages={messages}
        status={status}
        onThreadPrepared={setPreparedThreadKey}
      />
      <ConversationContent className="mx-auto w-full max-w-[803px] px-10 pb-10">
        <>
          {showInlineIntro ? <ChatEmptyState selectedProject={_selectedProject} /> : null}
          {timelineBlocks.map((block) => {
            if (block.type !== "message") {
              return null
            }

            const isLast = block.message.info.id === lastAssistantTextMessageId
            return (
              <ChatTimelineItem
                key={block.key}
                message={block.message}
                isStreaming={status === "streaming" && block.message.info.id === lastMessage?.info.id}
                showCopyAction={isLast}
                changedFilesSummary={isLast ? changedFilesSummaryByMessageId.get(block.message.info.id) : undefined}
                childSessions={childSessionData}
                workStartTime={
                  isLast && status === "streaming"
                    ? activeWorkStartTime ?? undefined
                    : undefined
                }
                completedWorkDurationMs={
                  isLast
                    ? block.message.info.id === lastCompletedWork?.messageId
                      ? lastCompletedWork.durationMs
                      : completedWorkDurationByMessageId.get(block.message.info.id)
                    : undefined
                }
              />
            )
          })}
          {orphanChildSessions.length > 0 ? (
            <div className="space-y-3">
              {orphanChildSessions.map((childSession) => (
                <InlineSubagentActivity key={childSession.session.id} childSession={childSession} />
              ))}
            </div>
          ) : null}
          {shouldRenderStreamingPlaceholder ? (
            <StreamingAssistantPlaceholder startTime={activeWorkStartTime} />
          ) : null}
        </>
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  )
}

function ChatAutoScroll({
  threadKey,
  messages,
  status,
  onThreadPrepared,
}: {
  threadKey: string
  messages: MessageWithParts[]
  status: "idle" | "streaming" | "error"
  onThreadPrepared: (threadKey: string) => void
}) {
  const { scrollToBottom, state } = useStickToBottomContext()
  const previousLastMessageIdRef = useRef<string | null>(null)
  const previousStatusRef = useRef<typeof status>(status)

  const lastMessage = messages[messages.length - 1] ?? null
  const lastMessageId = lastMessage?.info.id ?? null

  useLayoutEffect(() => {
    const targetScrollTop = state.calculatedTargetScrollTop
    state.scrollTop = targetScrollTop
    state.lastScrollTop = targetScrollTop
    previousLastMessageIdRef.current = lastMessageId
    previousStatusRef.current = status
    onThreadPrepared(threadKey)
  }, [lastMessageId, onThreadPrepared, state, status, threadKey])

  useEffect(() => {
    const previousLastMessageId = previousLastMessageIdRef.current
    const previousStatus = previousStatusRef.current
    const hasNewMessage = !!lastMessageId && lastMessageId !== previousLastMessageId
    const userJustSentMessage = hasNewMessage && lastMessage?.info.role === "user"
    const agentJustStartedResponding = status === "streaming" && previousStatus !== "streaming"

    if (userJustSentMessage || agentJustStartedResponding) {
      requestAnimationFrame(() => {
        void scrollToBottom("instant")
      })
    }

    previousLastMessageIdRef.current = lastMessageId
    previousStatusRef.current = status
  }, [lastMessage?.info.role, lastMessageId, scrollToBottom, status])

  return null
}


function StreamingAssistantPlaceholder({
  startTime,
}: {
  startTime: number | null
}) {
  const elapsed = useElapsedDuration(startTime, true)

  return (
    <MessageComponent from="assistant">
      <MessageContent>
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <LoadingDots />
          <span className="tabular-nums">{elapsed ?? formatElapsedDuration(0)}</span>
        </div>
      </MessageContent>
    </MessageComponent>
  )
}
