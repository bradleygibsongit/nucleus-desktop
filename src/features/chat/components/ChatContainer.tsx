import { useChat } from "../hooks/useChat"
import { ChatMessages } from "./ChatMessages"
import { ChatInput } from "./ChatInput"

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
          />
        </div>
      </div>
    </div>
  )
}
