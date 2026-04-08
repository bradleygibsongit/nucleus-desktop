import { useState, useEffect, useCallback } from "react"
import { desktop } from "@/desktop/client"
import type { SkillsSyncResponse } from "@/features/skills/types"
import { getHarnessAdapter } from "../runtime/harnesses"
import type { HarnessId } from "../types"

export interface NormalizedCommand {
  id: string
  name: string
  description: string
  kind: "builtin" | "custom"
  section: "system" | "skills"
  execution: "insert" | "run"
  action?: "new-chat"
  icon?: "skill" | "new-chat"
  agent?: string
  model?: string
  isPreview?: boolean
  referenceName?: string
}

const SYSTEM_COMMANDS: NormalizedCommand[] = [
  {
    id: "system:new-chat",
    name: "New Chat",
    description: "Open a new chat tab in the current project.",
    kind: "builtin",
    section: "system",
    execution: "run",
    action: "new-chat",
    icon: "new-chat",
  },
]

const BUILTIN_PREVIEW_COMMANDS: NormalizedCommand[] = [
  {
    id: "builtin:openai-docs",
    name: "OpenAI Docs",
    description: "Reference official OpenAI docs, including upgrade guidance.",
    kind: "builtin",
    section: "skills",
    execution: "insert",
    isPreview: true,
    referenceName: "openai-docs",
    icon: "skill",
  },
  {
    id: "builtin:skill-creator",
    name: "Skill Creator",
    description: "Create or update a skill.",
    kind: "builtin",
    section: "skills",
    execution: "insert",
    isPreview: true,
    referenceName: "skill-creator",
    icon: "skill",
  },
]

export function useCommands(harnessId: HarnessId | null) {
  const [commands, setCommands] = useState<NormalizedCommand[]>(SYSTEM_COMMANDS)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchCommands = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const [rawCommands, installedSkillsResponse] = await Promise.all([
        getHarnessAdapter(harnessId ?? "codex").listCommands(),
        desktop.skills.list().catch(() => null as SkillsSyncResponse | null),
      ])
      const installedSkillCommands: NormalizedCommand[] =
        installedSkillsResponse?.skills.map((skill) => ({
          id: `skill:${skill.id}`,
          name: skill.name,
          description: skill.description ?? "",
          kind: "custom",
          section: "skills",
          execution: "insert",
          isPreview: true,
          referenceName: skill.id,
          icon: "skill",
        })) ?? []
      const previewByName = new Map(
        installedSkillCommands.map((command) => [command.name.toLowerCase(), command])
      )

      const normalized: NormalizedCommand[] = rawCommands.map((cmd) => ({
        id: `command:${cmd.name.toLowerCase().replace(/\s+/g, "-")}`,
        name: cmd.name,
        description: cmd.description ?? "",
        kind: cmd.kind,
        section: "skills",
        execution: "insert",
        agent: cmd.agent,
        model: cmd.model,
        referenceName: previewByName.get(cmd.name.toLowerCase())?.referenceName,
        icon: "skill",
      }))

      const skillCommands = [
        ...normalized,
        ...installedSkillCommands.filter(
          (mockCommand) =>
            !normalized.some(
              (command) => command.name.toLowerCase() === mockCommand.name.toLowerCase()
            )
        ),
        ...BUILTIN_PREVIEW_COMMANDS.filter(
          (mockCommand) =>
            !normalized.some(
              (command) => command.name.toLowerCase() === mockCommand.name.toLowerCase()
            ) &&
            !installedSkillCommands.some(
              (command) => command.name.toLowerCase() === mockCommand.name.toLowerCase()
            )
        ),
      ]

      skillCommands.sort((a, b) => {
        if (a.kind !== b.kind) {
          return a.kind === "custom" ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })

      setCommands([...SYSTEM_COMMANDS, ...skillCommands])
    } catch (err) {
      console.error("[useCommands] Failed to fetch commands:", err)
      setError(String(err))
      setCommands([...SYSTEM_COMMANDS, ...BUILTIN_PREVIEW_COMMANDS])
    } finally {
      setIsLoading(false)
    }
  }, [harnessId])

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
