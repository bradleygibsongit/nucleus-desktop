import { useState, useEffect, useCallback } from "react"
import { useProjectStore } from "@/features/workspace/store"
import { useChatStore } from "../store/chatStore"

export interface NormalizedCommand {
  name: string
  description: string
  kind: "builtin" | "custom"
  agent?: string
  model?: string
  isPreview?: boolean
  referenceName?: string
}

const MOCK_SKILL_COMMANDS: NormalizedCommand[] = [
  {
    name: "Agent Client Protocol (acp)",
    description: 'This skill should be used when the user asks to "implement ACP", "create an ACP agent", or integrate ACP.',
    kind: "custom",
    isPreview: true,
    referenceName: "acp",
  },
  {
    name: "Find Skills",
    description: 'Helps users discover and install agent skills when they ask questions like "how do I do X".',
    kind: "custom",
    isPreview: true,
    referenceName: "find-skills",
  },
  {
    name: "Image Gen",
    description: "Generate and edit images using OpenAI.",
    kind: "custom",
    isPreview: true,
    referenceName: "imagegen",
  },
  {
    name: "Learn",
    description: "Capture session learnings into AGENTS.md files.",
    kind: "custom",
    isPreview: true,
    referenceName: "learn",
  },
  {
    name: "Linear",
    description: "Manage Linear issues in Codex.",
    kind: "custom",
    isPreview: true,
    referenceName: "linear",
  },
  {
    name: "OpenAI Docs",
    description: "Reference official OpenAI docs, including upgrade guidance.",
    kind: "builtin",
    isPreview: true,
    referenceName: "openai-docs",
  },
  {
    name: "Skill Creator",
    description: "Create or update a skill.",
    kind: "builtin",
    isPreview: true,
    referenceName: "skill-creator",
  },
]

export function useCommands() {
  const { selectedProjectId } = useProjectStore()
  const listCommands = useChatStore((state) => state.listCommands)
  const [commands, setCommands] = useState<NormalizedCommand[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchCommands = useCallback(async () => {
    if (!selectedProjectId) {
      setCommands([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const rawCommands = await listCommands(selectedProjectId)
      const previewByName = new Map(
        MOCK_SKILL_COMMANDS.map((command) => [command.name.toLowerCase(), command])
      )

      const normalized: NormalizedCommand[] = rawCommands.map((cmd) => ({
        name: cmd.name,
        description: cmd.description ?? "",
        kind: cmd.kind,
        agent: cmd.agent,
        model: cmd.model,
        referenceName: previewByName.get(cmd.name.toLowerCase())?.referenceName,
      }))

      const merged = [
        ...normalized,
        ...MOCK_SKILL_COMMANDS.filter(
          (mockCommand) =>
            !normalized.some(
              (command) => command.name.toLowerCase() === mockCommand.name.toLowerCase()
            )
        ),
      ]

      merged.sort((a, b) => {
        if (a.kind !== b.kind) {
          return a.kind === "custom" ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })

      setCommands(merged)
    } catch (err) {
      console.error("[useCommands] Failed to fetch commands:", err)
      setError(String(err))
      setCommands(MOCK_SKILL_COMMANDS)
    } finally {
      setIsLoading(false)
    }
  }, [listCommands, selectedProjectId])

  useEffect(() => {
    fetchCommands()
  }, [fetchCommands])

  return {
    commands,
    isLoading,
    error,
    refetch: fetchCommands,
  }
}

export function filterCommands(
  commands: NormalizedCommand[],
  query: string
): NormalizedCommand[] {
  const lowerQuery = query.toLowerCase()
  
  if (!lowerQuery) {
    return commands
  }

  return commands.filter(
    (cmd) =>
      cmd.name.toLowerCase().includes(lowerQuery) ||
      cmd.description.toLowerCase().includes(lowerQuery)
  )
}
