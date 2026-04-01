import { useEffect, useState } from "react"
import {
  useChatComposerState,
  useChatProjectState,
  useChatTimelineState,
} from "../hooks/useChat"
import { ChatMessages } from "./ChatMessages"
import { ChatInput } from "./ChatInput"

function ChatTimelinePane({
  threadKey,
  activeSessionId,
  selectedProject,
  showInlineIntro,
  workspaceSetupState,
}: {
  threadKey: string
  activeSessionId: string | null
  selectedProject: ReturnType<typeof useChatProjectState>["selectedProject"]
  showInlineIntro: boolean
  workspaceSetupState: ReturnType<typeof useChatProjectState>["workspaceSetupState"]
}) {
  const { messages, childSessions, status, activePromptState } =
    useChatTimelineState(activeSessionId)

  return (
    <ChatMessages
      threadKey={threadKey}
      messages={messages}
      status={status}
      activePromptState={activePromptState}
      selectedProject={selectedProject}
      childSessions={childSessions}
      showInlineIntro={showInlineIntro}
      workspaceSetupState={workspaceSetupState}
    />
  )
}

function ChatComposerPane({
  activeSessionId,
  selectedProjectId,
  selectedWorktreePath,
  selectedWorktreeId,
  selectedWorktree,
  isWorkspaceSetupRunning,
  onTurnStarted,
}: {
  activeSessionId: string | null
  selectedProjectId: string | null
  selectedWorktreePath?: string | null
  selectedWorktreeId: string | null
  selectedWorktree: ReturnType<typeof useChatProjectState>["selectedWorktree"]
  isWorkspaceSetupRunning: boolean
  onTurnStarted: () => void
}) {
  const {
    input,
    setInput,
    status,
    activePrompt,
    answerPrompt,
    dismissPrompt,
    abort,
    executeCommand,
    submit,
  } = useChatComposerState({
    selectedProjectId,
    selectedWorktreePath,
    selectedWorktreeId,
    selectedWorktree,
    activeSessionId,
  })

  return (
    <ChatInput
      input={input}
      setInput={setInput}
      isLocked={isWorkspaceSetupRunning}
      onSubmit={async (text, options) => {
        await submit(text, options)
      }}
      prompt={activePrompt}
      onAnswerPrompt={answerPrompt}
      onDismissPrompt={dismissPrompt}
      onAbort={abort}
      onExecuteCommand={async (command, args) => {
        if (
          command.trim() &&
          (activeSessionId != null || (selectedProjectId != null && selectedWorktreePath))
        ) {
          onTurnStarted()
        }

        const didStart = await executeCommand(command, args)
        if (didStart) {
          onTurnStarted()
        }
      }}
      status={status}
    />
  )
}

export function ChatContainer() {
  const {
    selectedProject,
    selectedProjectId,
    selectedWorktreeId,
    selectedWorktree,
    activeSessionId,
    workspaceSetupState,
  } = useChatProjectState()
  const { messages, childSessions, status, activePromptState } = useChatTimelineState(activeSessionId)
  const threadKey = `${selectedWorktreeId ?? selectedProject?.id ?? "no-project"}:${activeSessionId ?? "draft"}`
  const shouldShowDraftIntro =
    (activeSessionId == null || activeSessionId.startsWith("draft-")) &&
    messages.length === 0 &&
    status === "idle" &&
    activePromptState == null &&
    (childSessions?.size ?? 0) === 0
  const [showInlineIntro, setShowInlineIntro] = useState(shouldShowDraftIntro)

  useEffect(() => {
    setShowInlineIntro(shouldShowDraftIntro)
  }, [shouldShowDraftIntro, threadKey])

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 overflow-hidden">
        <ChatTimelinePane
          threadKey={threadKey}
          activeSessionId={activeSessionId}
          selectedProject={selectedProject}
          showInlineIntro={showInlineIntro}
          workspaceSetupState={workspaceSetupState}
        />
      </div>
      <div className="flex-shrink-0 flex justify-center">
        <div className="w-full max-w-[803px]">
          <ChatComposerPane
            activeSessionId={activeSessionId}
            selectedProjectId={selectedProjectId}
            selectedWorktreePath={selectedWorktree?.path ?? null}
            selectedWorktreeId={selectedWorktreeId}
            selectedWorktree={selectedWorktree}
            isWorkspaceSetupRunning={workspaceSetupState?.status === "running"}
            onTurnStarted={() => setShowInlineIntro(false)}
          />
        </div>
      </div>
    </div>
  )
}
