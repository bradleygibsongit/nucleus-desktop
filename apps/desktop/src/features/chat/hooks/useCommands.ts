import { useState, useEffect, useCallback } from "react"
import { desktop } from "@/desktop/client"
import type { SkillsSyncResponse } from "@/features/skills/types"
import type { ProjectAction } from "@/features/workspace/types"
import { getHarnessAdapter } from "../runtime/harnesses"
import type { HarnessId } from "../types"

export interface NormalizedCommand {
  id: string
  name: string
  description: string
  kind: "builtin" | "custom"
  section: "actions" | "custom-actions" | "commands" | "skills"
  execution: "insert" | "run"
  action?: "new-chat" | "new-terminal" | "theme"
  icon?: "skill" | "command" | "new-chat" | "new-terminal" | "theme"
  agent?: string
  model?: string
  isPreview?: boolean
  referenceName?: string
  insertText?: string
  inputHint?: string
  projectAction?: ProjectAction
}

const ACTION_COMMANDS: NormalizedCommand[] = [
  {
    id: "action:new-chat",
    name: "New Chat",
    description: "Open a new chat tab in the current project.",
    kind: "builtin",
    section: "actions",
    execution: "run",
    action: "new-chat",
    icon: "new-chat",
  },
  {
    id: "action:new-terminal",
    name: "New Terminal",
    description: "Open a new terminal tab in the current project.",
    kind: "builtin",
    section: "actions",
    execution: "run",
    action: "new-terminal",
    icon: "new-terminal",
  },
  {
    id: "action:theme",
    name: "Theme",
    description: "Browse and switch the desktop app theme.",
    kind: "builtin",
    section: "actions",
    execution: "run",
    action: "theme",
    icon: "theme",
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

const commandCache = new Map<string, NormalizedCommand[]>()

function buildProviderCommandDescription(description: string, inputHint?: string): string {
  const trimmedDescription = description.trim()
  const trimmedHint = inputHint?.trim()

  if (trimmedDescription && trimmedHint) {
    return `${trimmedDescription} Usage: ${trimmedHint}`
  }

  return trimmedDescription || trimmedHint || ""
}

export function useCommands(
  harnessId: HarnessId | null,
  projectActions: ProjectAction[] = [],
  projectPath?: string | null
) {
  const cacheKey = `${harnessId ?? "codex"}::${projectPath ?? ""}::${projectActions
    .map((action) => action.id)
    .join("|")}`
  const [commands, setCommands] = useState<NormalizedCommand[]>(
    () => commandCache.get(cacheKey) ?? ACTION_COMMANDS
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const cachedCommands = commandCache.get(cacheKey)
    if (cachedCommands) {
      setCommands(cachedCommands)
    }
  }, [cacheKey])

  const fetchCommands = useCallback(async () => {
    const cachedCommands = commandCache.get(cacheKey)
    setIsLoading(!cachedCommands)
    setError(null)

    try {
      const [rawCommands, installedSkillsResponse] = await Promise.all([
        getHarnessAdapter(harnessId ?? "codex").listCommands(projectPath ?? undefined),
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

      const normalized: NormalizedCommand[] = rawCommands.map((cmd) => ({
        id: `command:${cmd.name.toLowerCase().replace(/\s+/g, "-")}`,
        name: cmd.name,
        description: buildProviderCommandDescription(cmd.description ?? "", cmd.inputHint),
        kind: cmd.kind,
        section: "commands",
        execution: "insert",
        insertText: `/${cmd.name} `,
        inputHint: cmd.inputHint,
        agent: cmd.agent,
        model: cmd.model,
        icon: "command",
      }))

      const skillCommands = [
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

      normalized.sort((a, b) => a.name.localeCompare(b.name))

      skillCommands.sort((a, b) => {
        if (a.kind !== b.kind) {
          return a.kind === "custom" ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })

      const projectActionCommands: NormalizedCommand[] = projectActions.map((action) => ({
        id: `project-action:${action.id}`,
        name: action.name,
        description: "Run this project action in the current worktree terminal.",
        kind: "custom",
        section: "custom-actions",
        execution: "run",
        projectAction: action,
      }))

      const nextCommands = [...ACTION_COMMANDS, ...projectActionCommands, ...normalized, ...skillCommands]
      commandCache.set(cacheKey, nextCommands)
      setCommands(nextCommands)
    } catch (err) {
      console.error("[useCommands] Failed to fetch commands:", err)
      setError(String(err))
      const projectActionCommands: NormalizedCommand[] = projectActions.map((action) => ({
        id: `project-action:${action.id}`,
        name: action.name,
        description: "Run this project action in the current worktree terminal.",
        kind: "custom",
        section: "custom-actions",
        execution: "run",
        projectAction: action,
      }))
      const fallbackCommands = [...ACTION_COMMANDS, ...projectActionCommands, ...BUILTIN_PREVIEW_COMMANDS]
      commandCache.set(cacheKey, fallbackCommands)
      setCommands(fallbackCommands)
    } finally {
      setIsLoading(false)
    }
  }, [cacheKey, harnessId, projectActions, projectPath])

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
