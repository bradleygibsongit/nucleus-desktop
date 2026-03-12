import { ArrowMoveDownLeft, ArrowUp02, Brain, CaretDown, CaretLeft, CaretRight, CheckCircle, Circle, Stop } from "@/components/icons"
import { useState, useRef, useCallback, useMemo, useEffect, type KeyboardEvent as ReactKeyboardEvent, type FormEvent, type MutableRefObject } from "react"
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
import { LexicalComposer } from "@lexical/react/LexicalComposer"
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin"
import { ContentEditable } from "@lexical/react/LexicalContentEditable"
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin"
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin"
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import {
  $createLineBreakNode,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isLineBreakNode,
  $isRangeSelection,
  $isTextNode,
  type EditorState,
  type LexicalEditor,
  type LexicalNode,
} from "lexical"
import { $createSkillChipNode, $isSkillChipNode, SkillChipNode } from "./SkillChipNode"

type ComposerPlanStepStatus = "pending" | "in_progress" | "completed"

export interface ComposerPlanStep {
  id: string
  label: string
  status?: ComposerPlanStepStatus
}

export interface ComposerPlan {
  title: string
  summary?: string
  steps: ComposerPlanStep[]
}

export interface ComposerPromptOption {
  id: string
  label: string
  description?: string
}

export interface ComposerPromptQuestion {
  id: string
  label: string
  description?: string
  kind: "single_select" | "multi_select" | "text"
  options?: ComposerPromptOption[]
  required?: boolean
}

export interface ComposerPrompt {
  id: string
  title: string
  body?: string
  questions: ComposerPromptQuestion[]
}

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
  activePlan?: ComposerPlan | null
  prompt?: ComposerPrompt | null
}

function isQuestionAnswered(
  question: ComposerPromptQuestion,
  value: string | string[] | undefined,
  customValue?: string
): boolean {
  const normalizedCustomValue = customValue?.trim() ?? ""
  if (normalizedCustomValue.length > 0) {
    return true
  }

  if (!question.required) {
    return true
  }

  if (question.kind === "multi_select") {
    return Array.isArray(value) && value.length > 0
  }

  return typeof value === "string" && value.trim().length > 0
}

function serializePromptResponse(
  prompt: ComposerPrompt,
  answers: Record<string, string | string[]>,
  customAnswers: Record<string, string>
): string {
  const lines: string[] = []

  for (const question of prompt.questions) {
    const value = answers[question.id]
    const customValue = customAnswers[question.id]?.trim() ?? ""

    if (question.kind === "multi_select") {
      const selected = Array.isArray(value) ? value : []
      const parts = [...selected]
      if (customValue) {
        parts.push(customValue)
      }
      lines.push(`${question.label}: ${parts.length > 0 ? parts.join(", ") : "No response"}`)
      continue
    }

    const text =
      question.kind === "text"
        ? customValue
        : typeof value === "string" && value.trim().length > 0
          ? value.trim()
          : customValue
    lines.push(`${question.label}: ${text || "No response"}`)
  }

  return lines.join("\n")
}

function getModelsForHarness(harnessId: HarnessId | null): string[] {
  switch (harnessId) {
    case "codex":
      return ["GPT-5.4", "GPT-5", "GPT-5 mini"]
    case "claude-code":
      return ["Claude Sonnet 4.5", "Claude Opus 4.1"]
    default:
      return ["Default model"]
  }
}

function appendTextNodesToParagraph(text: string, paragraph: ReturnType<typeof $createParagraphNode>) {
  const segments = text.split("\n")

  segments.forEach((segment, index) => {
    if (segment.length > 0) {
      paragraph.append($createTextNode(segment))
    }

    if (index < segments.length - 1) {
      paragraph.append($createLineBreakNode())
    }
  })
}

function populateComposerFromSerializedValue(
  value: string,
  commandsByReference: Map<string, NormalizedCommand>
) {
  const root = $getRoot()
  const paragraph = $createParagraphNode()
  let lastIndex = 0

  root.clear()

  for (const match of value.matchAll(SKILL_REFERENCE_PATTERN)) {
    const fullMatch = match[0]
    const rawReference = match[1]
    const matchIndex = match.index ?? -1
    const referenceName = rawReference.toLowerCase()
    const command = commandsByReference.get(referenceName)

    if (matchIndex < 0) {
      continue
    }

    const textBefore = value.slice(lastIndex, matchIndex)
    if (textBefore.length > 0) {
      appendTextNodesToParagraph(textBefore, paragraph)
    }

    if (command?.referenceName) {
      paragraph.append($createSkillChipNode(command.referenceName, command.name))
    } else {
      appendTextNodesToParagraph(fullMatch, paragraph)
    }

    lastIndex = matchIndex + fullMatch.length
  }

  const remainingText = value.slice(lastIndex)
  if (remainingText.length > 0) {
    appendTextNodesToParagraph(remainingText, paragraph)
  }

  root.append(paragraph)
  root.selectEnd()
}

function serializeComposerNode(node: LexicalNode): string {
  if ($isSkillChipNode(node)) {
    return `$${node.getReferenceName()}`
  }

  if ($isLineBreakNode(node)) {
    return "\n"
  }

  if ($isTextNode(node)) {
    return node.getTextContent()
  }

  if ($isElementNode(node)) {
    return node.getChildren().map((child) => serializeComposerNode(child)).join("")
  }

  return ""
}

function serializeComposerState(): string {
  return $getRoot()
    .getChildren()
    .map((child) => serializeComposerNode(child))
    .join("\n")
}

const REASONING_EFFORTS = ["Low", "Medium", "High"] as const
const PROMPT_RESPONSE_ROW_CLASS = "min-h-[46px] rounded-2xl border px-3 py-2.5"
const SKILL_REFERENCE_PATTERN = /\$([a-z0-9][a-z0-9-]*)/gi

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
  activePlan,
  prompt,
}: ChatInputProps) {
  const [isImeComposing, setIsImeComposing] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [dismissedMenuKey, setDismissedMenuKey] = useState<string | null>(null)
  const [slashQuery, setSlashQuery] = useState("")
  const [isSlashMenuOpen, setIsSlashMenuOpen] = useState(false)
  const [promptAnswers, setPromptAnswers] = useState<Record<string, string | string[]>>({})
  const [promptCustomAnswers, setPromptCustomAnswers] = useState<Record<string, string>>({})
  const [currentPromptQuestionIndex, setCurrentPromptQuestionIndex] = useState(0)
  const [dismissedPromptId, setDismissedPromptId] = useState<string | null>(null)
  const availableModels = useMemo(
    () => getModelsForHarness(selectedHarnessId),
    [selectedHarnessId]
  )
  const [selectedModel, setSelectedModel] = useState(availableModels[0] ?? "Default model")
  const [reasoningEffort, setReasoningEffort] = useState<(typeof REASONING_EFFORTS)[number]>("High")
  const editorRef = useRef<LexicalEditor | null>(null)
  const serializedComposerValueRef = useRef(input)
  const previousCommandSignatureRef = useRef("")

  const { commands, isLoading: isLoadingCommands } = useCommands()
  const { agents, isLoading: isLoadingAgents } = useAgents()
  const { results: fileResults, isLoading: isLoadingFiles, search: searchFiles, clear: clearFiles } = useFileSearch()
  const selectedHarness = harnesses.find((harness) => harness.id === selectedHarnessId) ?? null
  const skillCommands = useMemo(
    () => commands.filter((command) => !!command.referenceName),
    [commands]
  )
  const commandsByReference = useMemo(
    () =>
      new Map(
        skillCommands.flatMap((command) =>
          command.referenceName ? [[command.referenceName.toLowerCase(), command] as const] : []
        )
      ),
    [skillCommands]
  )
  const commandSignature = useMemo(
    () => skillCommands.map((command) => command.referenceName).filter(Boolean).join("|"),
    [skillCommands]
  )

  const isStreaming = status === "streaming"
  const isPromptActive = !!prompt && dismissedPromptId !== prompt.id
  const currentPromptQuestion = isPromptActive ? prompt?.questions[currentPromptQuestionIndex] ?? null : null
  const currentPromptQuestionAnswered = currentPromptQuestion
    ? isQuestionAnswered(
        currentPromptQuestion,
        promptAnswers[currentPromptQuestion.id],
        promptCustomAnswers[currentPromptQuestion.id]
      )
    : false
  const isLastPromptQuestion = prompt
    ? currentPromptQuestionIndex === prompt.questions.length - 1
    : false

  const atMenuKey = input.startsWith("@") ? `at:${input}` : null
  const showSlashMenu = !isPromptActive && isSlashMenuOpen && !isStreaming

  const showAtMenu = !isPromptActive && input.startsWith("@") && !isStreaming && dismissedMenuKey !== atMenuKey
  const atQuery = showAtMenu ? input.slice(1) : ""
  const canSubmit = isPromptActive
    ? !!currentPromptQuestion && currentPromptQuestionAnswered && !isStreaming
    : input.trim().length > 0 && !isStreaming

  useEffect(() => {
    setPromptAnswers({})
    setPromptCustomAnswers({})
    setCurrentPromptQuestionIndex(0)
    setDismissedPromptId(null)
  }, [prompt?.id])

  useEffect(() => {
    setSelectedModel(availableModels[0] ?? "Default model")
  }, [availableModels])

  useEffect(() => {
    if (isPromptActive) {
      setIsSlashMenuOpen(false)
      setSlashQuery("")
    }
  }, [isPromptActive])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor || isPromptActive) {
      return
    }

    const commandSignatureChanged = previousCommandSignatureRef.current !== commandSignature
    previousCommandSignatureRef.current = commandSignature

    if (!commandSignatureChanged && input === serializedComposerValueRef.current) {
      return
    }

    editor.update(() => {
      populateComposerFromSerializedValue(input, commandsByReference)
    })
    serializedComposerValueRef.current = input
  }, [commandSignature, commandsByReference, input, isPromptActive])

  useEffect(() => {
    editorRef.current?.setEditable(!isStreaming)
  }, [isStreaming])

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
    if (!lowerQuery) return skillCommands
    
    return skillCommands.filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(lowerQuery) ||
        cmd.description.toLowerCase().includes(lowerQuery)
    )
  }, [showSlashMenu, skillCommands, slashQuery])

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
      const referenceName = command.referenceName
      const editor = editorRef.current

      if (!referenceName || !editor) {
        return
      }

      editor.focus()
      editor.update(() => {
        let selection = $getSelection()

        if (!$isRangeSelection(selection)) {
          $getRoot().selectEnd()
          selection = $getSelection()
        }

        if (!$isRangeSelection(selection)) {
          return
        }

        selection.insertNodes([
          $createSkillChipNode(referenceName, command.name),
          $createTextNode(" "),
        ])
      })
      setDismissedMenuKey(null)
      setIsSlashMenuOpen(false)
      setSlashQuery("")
    },
    []
  )

  const handleSelectAgent = useCallback(
    (agent: NormalizedAgent) => {
      setDismissedMenuKey(null)
      setInput(`@${agent.name} `)
      requestAnimationFrame(() => {
        editorRef.current?.focus()
      })
    },
    [setInput]
  )

  const handleSelectFile = useCallback(
    (file: FileItem) => {
      setDismissedMenuKey(null)
      setInput(`${file.path} `)
      requestAnimationFrame(() => {
        editorRef.current?.focus()
      })
    },
    [setInput]
  )

  const closeSlashMenu = useCallback(() => {
    setIsSlashMenuOpen(false)
    setSlashQuery("")
  }, [])

  const closeAtMenu = useCallback(() => {
    if (atMenuKey) {
      setDismissedMenuKey(atMenuKey)
    }
  }, [atMenuKey])

  const deleteAdjacentSkillChip = useCallback(() => {
    const editor = editorRef.current

    if (!editor) {
      return false
    }

    let handled = false

    editor.update(() => {
      const selection = $getSelection()

      if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
        return
      }

      const anchor = selection.anchor
      let previousNode: LexicalNode | null = null
      let leadingWhitespaceToTrim = 0
      let whitespaceNodeToTrim: LexicalNode | null = null

      if (anchor.type === "text") {
        const anchorNode = anchor.getNode()
        const anchorText = anchorNode.getTextContent()

        if (anchor.offset === 0) {
          previousNode = anchorNode.getPreviousSibling()
        } else {
          const textBeforeCaret = anchorText.slice(0, anchor.offset)

          if (textBeforeCaret.trim().length > 0) {
            return
          }

          previousNode = anchorNode.getPreviousSibling()
          leadingWhitespaceToTrim = anchor.offset
          whitespaceNodeToTrim = anchorNode
        }
      } else {
        const anchorNode = anchor.getNode()
        const directPreviousNode =
          anchor.offset > 0
            ? anchorNode.getChildAtIndex(anchor.offset - 1)
            : anchorNode.getPreviousSibling()

        if ($isTextNode(directPreviousNode)) {
          const previousText = directPreviousNode.getTextContent()

          if (previousText.trim().length > 0) {
            return
          }

          previousNode = directPreviousNode.getPreviousSibling()
          leadingWhitespaceToTrim = previousText.length
          whitespaceNodeToTrim = directPreviousNode
        } else {
          previousNode = directPreviousNode
        }
      }

      if (!$isSkillChipNode(previousNode)) {
        return
      }

      if ($isTextNode(whitespaceNodeToTrim) && leadingWhitespaceToTrim > 0) {
        const remainingText = whitespaceNodeToTrim.getTextContent().slice(leadingWhitespaceToTrim)

        if (remainingText.length === 0) {
          whitespaceNodeToTrim.remove()
        } else {
          whitespaceNodeToTrim.setTextContent(remainingText)
        }
      }

      const nextSibling = previousNode.getNextSibling()
      if ($isTextNode(nextSibling)) {
        const nextText = nextSibling.getTextContent()

        if (nextText === " ") {
          nextSibling.remove()
        } else if (nextText.startsWith(" ")) {
          nextSibling.setTextContent(nextText.slice(1))
        }
      }

      previousNode.remove()
      handled = true
    })

    return handled
  }, [])

  const handlePromptAnswerChange = useCallback(
    (questionId: string, value: string | string[]) => {
      setPromptAnswers((current) => ({
        ...current,
        [questionId]: value,
      }))

      if (
        prompt &&
        currentPromptQuestion &&
        currentPromptQuestion.id === questionId &&
        currentPromptQuestion.kind === "single_select" &&
        isQuestionAnswered(
          currentPromptQuestion,
          value,
          promptCustomAnswers[currentPromptQuestion.id]
        ) &&
        !isLastPromptQuestion
      ) {
        setCurrentPromptQuestionIndex((index) =>
          Math.min(index + 1, prompt.questions.length - 1)
        )
      }
    },
    [currentPromptQuestion, isLastPromptQuestion, prompt, promptCustomAnswers]
  )

  const handlePromptCustomAnswerChange = useCallback(
    (questionId: string, value: string) => {
      setPromptCustomAnswers((current) => ({
        ...current,
        [questionId]: value,
      }))
    },
    []
  )

  const handleDismissPrompt = useCallback(() => {
    if (!prompt) {
      return
    }

    setDismissedPromptId(prompt.id)
  }, [prompt])

  const handleGoToPreviousPromptQuestion = useCallback(() => {
    setCurrentPromptQuestionIndex((index) => Math.max(index - 1, 0))
  }, [])

  const handleGoToNextPromptQuestion = useCallback(() => {
    if (!prompt) {
      return
    }

    setCurrentPromptQuestionIndex((index) =>
      Math.min(index + 1, prompt.questions.length - 1)
    )
  }, [prompt])

  useEffect(() => {
    if (!isPromptActive) {
      return
    }

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        handleDismissPrompt()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleDismissPrompt, isPromptActive])

  const promptProgressLabel = isPromptActive && prompt
    ? `${currentPromptQuestionIndex + 1} of ${prompt.questions.length}`
    : null

  const isFirstPromptQuestion = currentPromptQuestionIndex === 0

  const selectorsRow = !isPromptActive
  const showPromptDismiss = isPromptActive

  const promptCtaLabel = isLastPromptQuestion ? "Submit" : "Continue"

  const promptRightControls = isPromptActive ? (
    <>
      <button
        type="button"
        onClick={handleDismissPrompt}
        className="inline-flex h-8 items-center gap-2 rounded-full px-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <span>Dismiss</span>
        <span className="rounded-md border border-border/70 px-1.5 py-0.5 text-[11px] leading-none text-muted-foreground">
          Esc
        </span>
      </button>
      <button
        type="submit"
        disabled={!canSubmit}
        className="inline-flex h-8 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-40"
      >
        <span>{promptCtaLabel}</span>
        <span className="flex size-5 items-center justify-center rounded-md border border-primary-foreground/20 text-primary-foreground/85">
          <ArrowMoveDownLeft className="size-3" />
        </span>
      </button>
    </>
  ) : null
  

  const handleSubmit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault()

      if (isPromptActive && prompt) {
        if (!currentPromptQuestion || !currentPromptQuestionAnswered) {
          return
        }

        if (!isLastPromptQuestion) {
          setCurrentPromptQuestionIndex((index) =>
            Math.min(index + 1, prompt.questions.length - 1)
          )
          return
        }

        onSubmit(serializePromptResponse(prompt, promptAnswers, promptCustomAnswers))
        setDismissedPromptId(prompt.id)
        setCurrentPromptQuestionIndex(0)
        setPromptAnswers({})
        setPromptCustomAnswers({})
        return
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

      const trimmedInput = input.trim()
      if (trimmedInput.startsWith("/") && !trimmedInput.includes(" ")) {
        const commandName = trimmedInput.slice(1)
        const matchingCommand = commands.find((command) => command.name === commandName)

        if (matchingCommand?.isPreview) {
          return
        }

        if (matchingCommand && onExecuteCommand) {
          onExecuteCommand(matchingCommand.name, "")
          setDismissedMenuKey(null)
          setInput("")
          return
        }
      }

      // Check if message starts with @agent pattern
      const agentMatch = input.match(/^@(\w+)\s+(.*)$/s)
      if (agentMatch) {
        const [, agentName, message] = agentMatch
        onSubmit(message.trim(), { agent: agentName })
      } else {
        onSubmit(input.trim())
      }
    },
    [
      canSubmit,
      input,
      isPromptActive,
      onSubmit,
      prompt,
      promptAnswers,
      promptCustomAnswers,
      currentPromptQuestion,
      currentPromptQuestionAnswered,
      isLastPromptQuestion,
      commands,
      onExecuteCommand,
      setInput,
      showAtMenu,
      atMenuTotalItems,
      filteredAgents,
      filteredFiles,
      handleSelectAgent,
      handleSelectFile,
    ]
  )

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (isPromptActive) {
        return
      }

      if (
        e.key === "Backspace" &&
        !showSlashMenu &&
        !showAtMenu &&
        deleteAdjacentSkillChip()
      ) {
        e.preventDefault()
        return
      }

      if (
        e.key === "/" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !showAtMenu
      ) {
        e.preventDefault()
        setDismissedMenuKey(null)
        setIsSlashMenuOpen(true)
        setSlashQuery("")
        setSelectedIndex(0)
        return
      }

      if (showSlashMenu) {
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
        if (e.key === "Backspace") {
          e.preventDefault()

          if (slashQuery.length > 0) {
            setSlashQuery((current) => current.slice(0, -1))
          } else {
            closeSlashMenu()
          }

          return
        }
        if (e.key === "Tab") {
          e.preventDefault()
          const selectedCommand = filteredCommands[selectedIndex]
          if (selectedCommand) {
            handleSelectCommand(selectedCommand)
          }
          return
        }
        if (e.key === "Enter" && !e.shiftKey && !isImeComposing) {
          e.preventDefault()
          const selectedCommand = filteredCommands[selectedIndex]
          if (selectedCommand) {
            handleSelectCommand(selectedCommand)
          }
          return
        }
        if (e.key === " " && slashQuery.length === 0) {
          e.preventDefault()
          closeSlashMenu()
          return
        }
        if (
          e.key.length === 1 &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey
        ) {
          e.preventDefault()
          setSlashQuery((current) => `${current}${e.key}`)
          setSelectedIndex(0)
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

      if (e.key === "Enter" && !e.shiftKey && !isImeComposing) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [
      handleSubmit,
      isImeComposing,
      isPromptActive,
      showSlashMenu,
      slashQuery.length,
      filteredCommands,
      selectedIndex,
      closeSlashMenu,
      handleSelectCommand,
      showAtMenu,
      atMenuTotalItems,
      filteredAgents,
      filteredFiles,
      closeAtMenu,
      deleteAdjacentSkillChip,
    ]
  )

  const handleComposerChange = useCallback(
    (editorState: EditorState) => {
      const nextValue = editorState.read(() => serializeComposerState())
      serializedComposerValueRef.current = nextValue

      if (nextValue !== input) {
        setDismissedMenuKey(null)
        setInput(nextValue)
      }
    },
    [input, setInput]
  )

  const composerInitialConfig = useMemo(
    () => ({
      namespace: "nucleus-chat-composer",
      nodes: [SkillChipNode],
      onError(error: Error) {
        throw error
      },
      editorState() {
        populateComposerFromSerializedValue(input, commandsByReference)
      },
    }),
    [commandsByReference, input]
  )

  return (
    <form onSubmit={handleSubmit} className="bg-main-content px-10 pb-3">
      <div className="relative rounded-2xl border border-border bg-card shadow-sm">
        {activePlan && (
          <div className="relative border-b border-border">
            {activePlan && (
              <div className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted">
                    <Brain className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{activePlan.title}</p>
                        {activePlan.summary && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{activePlan.summary}</p>
                        )}
                      </div>
                      <span className="rounded-full border border-border bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                        {activePlan.steps.length} steps
                      </span>
                    </div>
                    <div className="mt-3 flex flex-col gap-2">
                      {activePlan.steps.map((step, index) => {
                        const StepIcon =
                          step.status === "completed" ? CheckCircle : Circle

                        return (
                          <div key={step.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <StepIcon
                              className={
                                step.status === "completed"
                                  ? "size-3.5 text-foreground"
                                  : "size-3.5 text-muted-foreground/60"
                              }
                            />
                            <span className="text-[11px] text-muted-foreground/70">{index + 1}.</span>
                            <span className={step.status === "completed" ? "text-foreground" : ""}>
                              {step.label}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="relative px-4 pt-3 pb-3">
          {isPromptActive && prompt ? (
            <StructuredPromptSurface
              prompt={prompt}
              answers={promptAnswers}
              customAnswers={promptCustomAnswers}
              onAnswerChange={handlePromptAnswerChange}
              onCustomAnswerChange={handlePromptCustomAnswerChange}
              currentQuestionIndex={currentPromptQuestionIndex}
              progressLabel={promptProgressLabel ?? ""}
              onPreviousQuestion={handleGoToPreviousPromptQuestion}
              onNextQuestion={handleGoToNextPromptQuestion}
              canGoPrevious={!isFirstPromptQuestion}
              canGoNext={!isLastPromptQuestion}
            />
          ) : (
            <>
              <LexicalComposer initialConfig={composerInitialConfig}>
                <ComposerEditorRefPlugin editorRef={editorRef} />
                <OnChangePlugin onChange={handleComposerChange} />
                <HistoryPlugin />
                <PlainTextPlugin
                  contentEditable={
                    <ContentEditable
                      onKeyDown={handleKeyDown}
                      onCompositionStart={() => setIsImeComposing(true)}
                      onCompositionEnd={() => setIsImeComposing(false)}
                      aria-placeholder="Ask follow-up changes"
                      className="app-scrollbar w-full min-h-9 max-h-[268px] overflow-y-auto bg-transparent text-[14px] leading-5 text-foreground outline-none"
                    />
                  }
                  placeholder={
                    <div className="pointer-events-none absolute top-2.5 left-4 text-[14px] leading-5 text-muted-foreground/75">
                      Ask follow-up changes
                    </div>
                  }
                  ErrorBoundary={LexicalErrorBoundary}
                />
              </LexicalComposer>

              {showSlashMenu && (
                <div className="mb-3">
                  <SlashCommandMenu
                    commands={filteredCommands}
                    query={slashQuery}
                    isLoading={isLoadingCommands}
                    onSelect={handleSelectCommand}
                    onClose={closeSlashMenu}
                    selectedIndex={selectedIndex}
                  />
                </div>
              )}

              {showAtMenu && (
                <div className="mb-3">
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
                </div>
              )}
            </>
          )}

          <div className="mt-4 flex items-center gap-2">
            {selectorsRow && selectedHarness && (
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex h-8 items-center gap-2 px-1 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground cursor-pointer">
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
            )}

            {selectorsRow && <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-8 items-center gap-2 px-1 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground cursor-pointer">
                <span>{selectedModel}</span>
                <CaretDown className="size-3 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {availableModels.map((model) => (
                  <DropdownMenuItem
                    key={model}
                    onClick={() => setSelectedModel(model)}
                    className="flex items-center justify-between gap-3"
                  >
                    <span>{model}</span>
                    {model === selectedModel && <CheckCircle className="size-3.5 text-muted-foreground" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>}

            {selectorsRow && <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-8 items-center gap-2 px-1 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground cursor-pointer">
                <span>{reasoningEffort}</span>
                <CaretDown className="size-3 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40">
                {REASONING_EFFORTS.map((effort) => (
                  <DropdownMenuItem
                    key={effort}
                    onClick={() => setReasoningEffort(effort)}
                    className="flex items-center justify-between gap-3"
                  >
                    <span>{effort}</span>
                    {effort === reasoningEffort && <CheckCircle className="size-3.5 text-muted-foreground" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>}

            <div className="ml-auto flex items-center gap-2">
              {isStreaming ? (
                <button
                  type="button"
                  onClick={onAbort}
                  className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-85"
                >
                  <Stop weight="fill" className="size-4" />
                </button>
              ) : showPromptDismiss ? (
                promptRightControls
              ) : (
                <button
                  type="submit"
                  disabled={!canSubmit && !showSlashMenu && !showAtMenu}
                  className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
                >
                  <ArrowUp02 weight="bold" className="size-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </form>
  )
}

function ComposerEditorRefPlugin({
  editorRef,
}: {
  editorRef: MutableRefObject<LexicalEditor | null>
}) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    editorRef.current = editor

    return () => {
      if (editorRef.current === editor) {
        editorRef.current = null
      }
    }
  }, [editor, editorRef])

  return null
}

interface StructuredPromptSurfaceProps {
  prompt: ComposerPrompt
  answers: Record<string, string | string[]>
  customAnswers: Record<string, string>
  onAnswerChange: (questionId: string, value: string | string[]) => void
  onCustomAnswerChange: (questionId: string, value: string) => void
  currentQuestionIndex: number
  progressLabel: string
  onPreviousQuestion: () => void
  onNextQuestion: () => void
  canGoPrevious: boolean
  canGoNext: boolean
}

function StructuredPromptSurface({
  prompt,
  answers,
  customAnswers,
  onAnswerChange,
  onCustomAnswerChange,
  currentQuestionIndex,
  progressLabel,
  onPreviousQuestion,
  onNextQuestion,
  canGoPrevious,
  canGoNext,
}: StructuredPromptSurfaceProps) {
  const question = prompt.questions[currentQuestionIndex]

  if (!question) {
    return null
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-foreground">{question.label}</p>
        <div className="flex items-center gap-0 text-muted-foreground">
          <button
            type="button"
            onClick={onPreviousQuestion}
            disabled={!canGoPrevious}
            className="flex size-6 items-center justify-center rounded-full transition-colors hover:text-foreground disabled:opacity-35"
            aria-label="Previous question"
          >
            <CaretLeft className="size-3.5" />
          </button>
          <span className="min-w-[2.2rem] text-center text-[12px]">{progressLabel}</span>
          <button
            type="button"
            onClick={onNextQuestion}
            disabled={!canGoNext}
            className="flex size-6 items-center justify-center rounded-full transition-colors hover:text-foreground disabled:opacity-35"
            aria-label="Next question"
          >
            <CaretRight className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {question.kind === "single_select" && (
          <div className="flex flex-col gap-2">
            {(question.options ?? []).map((option) => {
              const selectedValue = typeof answers[question.id] === "string" ? answers[question.id] : ""
              const isSelected = selectedValue === option.label

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onAnswerChange(question.id, option.label)}
                  className={`flex ${PROMPT_RESPONSE_ROW_CLASS} items-center gap-3 text-left transition-colors ${
                    isSelected
                      ? "border-foreground/20 bg-background text-foreground"
                      : "border-border/70 bg-background/50 text-muted-foreground hover:bg-background"
                  }`}
                >
                  <span
                    className={`block size-3 shrink-0 rounded-full border ${
                      isSelected ? "border-foreground bg-foreground" : "border-muted-foreground/40"
                    }`}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm">{option.label}</span>
                    {option.description && (
                      <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                        {option.description}
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {question.kind === "multi_select" && (
          <div className="flex flex-col gap-2">
            {(question.options ?? []).map((option) => {
              const selectedValues = Array.isArray(answers[question.id]) ? answers[question.id] : []
              const isSelected = selectedValues.includes(option.label)

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() =>
                    onAnswerChange(
                      question.id,
                      isSelected
                        ? selectedValues.filter((value) => value !== option.label)
                        : selectedValues.concat(option.label)
                    )
                  }
                  className={`flex ${PROMPT_RESPONSE_ROW_CLASS} items-center gap-3 text-left transition-colors ${
                    isSelected
                      ? "border-foreground/20 bg-background text-foreground"
                      : "border-border/70 bg-background/50 text-muted-foreground hover:bg-background"
                  }`}
                >
                  <span
                    className={`flex size-3 shrink-0 items-center justify-center rounded-[4px] border ${
                      isSelected ? "border-foreground bg-foreground" : "border-muted-foreground/40"
                    }`}
                  >
                    {isSelected && <span className="block size-1.5 rounded-sm bg-background" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm">{option.label}</span>
                    {option.description && (
                      <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                        {option.description}
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <div
          className={`flex ${PROMPT_RESPONSE_ROW_CLASS} items-center border-border/70 bg-background/50 transition-colors focus-within:border-foreground/20 focus-within:bg-background`}
        >
          <input
            value={customAnswers[question.id] ?? ""}
            onChange={(event) => onCustomAnswerChange(question.id, event.target.value)}
            placeholder="No and tell the ai what to do differently"
            className="w-full bg-transparent text-sm leading-5 text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>
    </div>
  )
}
