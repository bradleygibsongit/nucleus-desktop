import { useChat } from "../hooks/useChat"
import { ChatMessages } from "./ChatMessages"
import { ChatInput, type ComposerPrompt } from "./ChatInput"

const MOCK_COMPOSER_PROMPT: ComposerPrompt = {
  id: "mock-composer-prompt",
  title: "Help me choose the next composer behavior",
  body: "Pick the interaction you want me to optimize first. This is a temporary preview of the structured question state.",
  questions: [
    {
      id: "composer-mode",
      label: "Which mode should the composer switch into?",
      kind: "single_select",
      required: true,
      options: [
        { id: "structured-questions", label: "Structured questions" },
        { id: "queued-messages", label: "Queued messages" },
        { id: "plan-view", label: "Plan view above input" },
      ],
    },
    {
      id: "visible-context",
      label: "What should stay visible above the input?",
      kind: "multi_select",
      required: true,
      options: [
        { id: "active-plan", label: "Active plan" },
        { id: "queued-messages", label: "Queued messages" },
        { id: "agent-questions", label: "Agent questions" },
        { id: "draft-preview", label: "Draft preview" },
      ],
    },
    {
      id: "notes",
      label: "Anything else you want in this state?",
      kind: "text",
      description: "Use this freeform field to describe layout or interaction tweaks.",
    },
  ],
}

export function ChatContainer() {
  const {
    messages,
    childSessions,
    status,
    input,
    setInput,
    handleSubmit,
    abort,
    selectedProject,
    harnesses,
    selectedHarnessId,
    selectHarness,
    activeSessionId,
    createSession,
    executeCommand,
  } = useChat()

  // Handle submit - create session if needed
  const handleSubmitWithSession = async (text: string, options?: { agent?: string }) => {
    let sessionId = activeSessionId
    
    if (!sessionId) {
      // Create a new session first
      const session = await createSession()
      if (!session) {
        console.error("[ChatContainer] Failed to create session")
        return
      }
      sessionId = session.id
    }
    
    // Pass the session ID and agent directly to avoid stale closure issue
    await handleSubmit(text, sessionId, options?.agent)
  }

  // Handle command execution - create session if needed
  const handleExecuteCommand = async (command: string, args?: string) => {
    let sessionId = activeSessionId
    
    if (!sessionId) {
      // Create a new session first
      const session = await createSession()
      if (!session) {
        console.error("[ChatContainer] Failed to create session for command")
        return
      }
      sessionId = session.id
    }
    
    await executeCommand(command, args, sessionId)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 flex justify-center overflow-hidden">
        <div className="w-full max-w-[803px]">
          <ChatMessages
            messages={messages}
            status={status}
            selectedProject={selectedProject}
            childSessions={childSessions}
          />
        </div>
      </div>
      <div className="flex-shrink-0 flex justify-center">
        <div className="w-full max-w-[803px]">
          <ChatInput
            input={input}
            setInput={setInput}
            onSubmit={handleSubmitWithSession}
            onAbort={abort}
            onExecuteCommand={handleExecuteCommand}
            harnesses={harnesses}
            selectedHarnessId={selectedHarnessId}
            onSelectHarness={selectHarness}
            status={status}
            prompt={MOCK_COMPOSER_PROMPT}
          />
        </div>
      </div>
    </div>
  )
}
