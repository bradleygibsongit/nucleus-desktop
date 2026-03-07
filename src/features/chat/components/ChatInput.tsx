import { ArrowUp, CaretDown, Stop } from "@/components/icons"
import { useState, useRef, useCallback, useMemo, useEffect, type KeyboardEvent, type FormEvent } from "react"
import { SlashCommandMenu } from "./SlashCommandMenu"
import { AtMentionMenu, type FileItem } from "./AtMentionMenu"
import { useCommands, type NormalizedCommand } from "../hooks/useCommands"
import { useAgents, type NormalizedAgent } from "../hooks/useAgents"
import { useFileSearch } from "../hooks/useFileSearch"
import type { HarnessDefinition, HarnessId } from "../types"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/features/shared/components/ui/dropdown-menu"

interface ChatInputProps {
  input: string
  setInput: (value: string) => void
  onSubmit: (text: string, options?: { agent?: string }) => void
  onAbort?: () => void
  onExecuteCommand?: (command: string, args?: string) => void
  harnesses: HarnessDefinition[]
  selectedHarnessId: HarnessId | null
  onSelectHarness?: (harnessId: HarnessId) => void
  status: "idle" | "streaming" | "error"
}

export function ChatInput({
  input,
  setInput,
  onSubmit,
  onAbort,
  onExecuteCommand,
  harnesses,
  selectedHarnessId,
  onSelectHarness,
  status,
}: ChatInputProps) {
  const [isComposing, setIsComposing] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  const { commands, isLoading: isLoadingCommands } = useCommands()
  const { agents, isLoading: isLoadingAgents } = useAgents()
  const { results: fileResults, isLoading: isLoadingFiles, search: searchFiles, clear: clearFiles } = useFileSearch()
  const selectedHarness = harnesses.find((harness) => harness.id === selectedHarnessId) ?? null

  const isStreaming = status === "streaming"
  const canSubmit = input.trim().length > 0 && !isStreaming

  // Determine if slash menu should be shown (starts with /)
  const showSlashMenu = input.startsWith("/") && !isStreaming
  const slashQuery = showSlashMenu ? input.slice(1) : ""

  // Determine if @ mention menu should be shown (starts with @)
  const showAtMenu = input.startsWith("@") && !isStreaming
  const atQuery = showAtMenu ? input.slice(1) : ""

  // Search files when @ query changes
  useEffect(() => {
    if (showAtMenu && atQuery.length > 0) {
      searchFiles(atQuery)
    } else {
      clearFiles()
    }
  }, [showAtMenu, atQuery, searchFiles, clearFiles])

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!showSlashMenu) return []
    
    const lowerQuery = slashQuery.toLowerCase()
    if (!lowerQuery) return commands
    
    return commands.filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(lowerQuery) ||
        cmd.description.toLowerCase().includes(lowerQuery)
    )
  }, [commands, showSlashMenu, slashQuery])

  // Filter agents based on query
  const filteredAgents = useMemo(() => {
    if (!showAtMenu) return []
    
    const lowerQuery = atQuery.toLowerCase()
    if (!lowerQuery) return agents
    
    return agents.filter(
      (agent) =>
        agent.name.toLowerCase().includes(lowerQuery) ||
        agent.description.toLowerCase().includes(lowerQuery)
    )
  }, [agents, showAtMenu, atQuery])

  // Convert file results to FileItem format
  const filteredFiles: FileItem[] = useMemo(() => {
    if (!showAtMenu) return []
    return fileResults.map((f) => ({ path: f.path, type: f.type }))
  }, [showAtMenu, fileResults])

  // Total items in @ menu
  const atMenuTotalItems = filteredAgents.length + filteredFiles.length

  // Reset selected index when filtered items change
  useEffect(() => {
    setSelectedIndex(0)
  }, [filteredCommands.length, atMenuTotalItems])

  const handleSelectCommand = useCallback(
    (command: NormalizedCommand) => {
      if (onExecuteCommand) {
        onExecuteCommand(command.name, "")
      }
      setInput("")
    },
    [onExecuteCommand, setInput]
  )

  const handleSelectAgent = useCallback(
    (agent: NormalizedAgent) => {
      // Insert @agent at the beginning and let user continue typing
      setInput(`@${agent.name} `)
      textareaRef.current?.focus()
    },
    [setInput]
  )

  const handleSelectFile = useCallback(
    (file: FileItem) => {
      // Insert file path and let user continue typing
      setInput(`${file.path} `)
      textareaRef.current?.focus()
    },
    [setInput]
  )

  const closeSlashMenu = useCallback(() => {
    setInput("")
  }, [setInput])

  const closeAtMenu = useCallback(() => {
    setInput("")
  }, [setInput])

  const handleSubmit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault()
      
      // If slash menu is open and we have filtered commands, execute selected command
      if (showSlashMenu && filteredCommands.length > 0) {
        const selectedCommand = filteredCommands[selectedIndex]
        if (selectedCommand) {
          handleSelectCommand(selectedCommand)
          return
        }
      }

      // If @ menu is open, select the item
      if (showAtMenu && atMenuTotalItems > 0) {
        if (selectedIndex < filteredAgents.length) {
          handleSelectAgent(filteredAgents[selectedIndex])
        } else {
          handleSelectFile(filteredFiles[selectedIndex - filteredAgents.length])
        }
        return
      }
      
      if (!canSubmit) return

      // Check if message starts with @agent pattern
      const agentMatch = input.match(/^@(\w+)\s+(.*)$/s)
      if (agentMatch) {
        const [, agentName, message] = agentMatch
        onSubmit(message.trim(), { agent: agentName })
      } else {
        onSubmit(input.trim())
      }
    },
    [canSubmit, input, onSubmit, showSlashMenu, filteredCommands, selectedIndex, handleSelectCommand, showAtMenu, atMenuTotalItems, filteredAgents, filteredFiles, handleSelectAgent, handleSelectFile]
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Handle slash menu navigation
      if (showSlashMenu && filteredCommands.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault()
          setSelectedIndex((prev) => 
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          )
          return
        }
        if (e.key === "ArrowUp") {
          e.preventDefault()
          setSelectedIndex((prev) => 
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          )
          return
        }
        if (e.key === "Escape") {
          e.preventDefault()
          closeSlashMenu()
          return
        }
        if (e.key === "Tab") {
          e.preventDefault()
          const selectedCommand = filteredCommands[selectedIndex]
          if (selectedCommand) {
            setInput(`/${selectedCommand.name}`)
          }
          return
        }
      }

      // Handle @ menu navigation
      if (showAtMenu && atMenuTotalItems > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault()
          setSelectedIndex((prev) => 
            prev < atMenuTotalItems - 1 ? prev + 1 : 0
          )
          return
        }
        if (e.key === "ArrowUp") {
          e.preventDefault()
          setSelectedIndex((prev) => 
            prev > 0 ? prev - 1 : atMenuTotalItems - 1
          )
          return
        }
        if (e.key === "Escape") {
          e.preventDefault()
          closeAtMenu()
          return
        }
        if (e.key === "Tab") {
          e.preventDefault()
          if (selectedIndex < filteredAgents.length) {
            setInput(`@${filteredAgents[selectedIndex].name} `)
          } else {
            setInput(`${filteredFiles[selectedIndex - filteredAgents.length].path} `)
          }
          return
        }
      }

      if (e.key === "Enter" && !e.shiftKey && !isComposing) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit, isComposing, showSlashMenu, filteredCommands, selectedIndex, closeSlashMenu, setInput, showAtMenu, atMenuTotalItems, filteredAgents, filteredFiles, closeAtMenu]
  )

  return (
    <form onSubmit={handleSubmit} className="bg-main-content px-10 pb-4">
      <div className="relative flex flex-col gap-2 rounded-[6px] border border-border bg-card p-3">
        {selectedHarness && (
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer">
                <span>{selectedHarness.label}</span>
                <CaretDown className="size-3 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                {harnesses.map((harness) => (
                  <DropdownMenuItem
                    key={harness.id}
                    onClick={() => onSelectHarness?.(harness.id)}
                    className="flex flex-col items-start gap-0.5"
                  >
                    <div className="flex w-full items-center justify-between gap-3">
                      <span className="font-medium">{harness.label}</span>
                      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {harness.adapterStatus}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {harness.description}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="text-xs text-muted-foreground">
              Each harness plugs into the same chat UI through a thin adapter layer.
            </span>
          </div>
        )}

        {/* Slash Command Menu */}
        {showSlashMenu && (
          <SlashCommandMenu
            commands={filteredCommands}
            query={slashQuery}
            isLoading={isLoadingCommands}
            onSelect={handleSelectCommand}
            onClose={closeSlashMenu}
            selectedIndex={selectedIndex}
          />
        )}

        {/* @ Mention Menu */}
        {showAtMenu && (
          <AtMentionMenu
            agents={filteredAgents}
            files={filteredFiles}
            query={atQuery}
            isLoading={isLoadingAgents || isLoadingFiles}
            onSelectAgent={handleSelectAgent}
            onSelectFile={handleSelectFile}
            onClose={closeAtMenu}
            selectedIndex={selectedIndex}
          />
        )}

        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          placeholder="Type a message... (/ for commands, @ for agents)"
          disabled={isStreaming}
          className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none field-sizing-content min-h-[60px] max-h-48"
        />
        <div className="flex items-center justify-end">
          {isStreaming ? (
            <button
              type="button"
              onClick={onAbort}
              className="flex size-8 items-center justify-center rounded-[6px] bg-destructive/10 text-destructive"
            >
              <Stop weight="fill" className="size-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSubmit && !showSlashMenu && !showAtMenu}
              className="flex size-8 items-center justify-center rounded-[6px] bg-primary text-primary-foreground disabled:opacity-40"
            >
              <ArrowUp weight="bold" className="size-4" />
            </button>
          )}
        </div>
      </div>
    </form>
  )
}
