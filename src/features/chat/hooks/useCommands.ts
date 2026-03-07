import { useState, useEffect, useCallback } from "react"
import { useProjectStore } from "@/features/workspace/store"
import { useChatStore } from "../store/chatStore"

export interface NormalizedCommand {
  name: string
  description: string
  kind: "builtin" | "custom"
  agent?: string
  model?: string
}

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

      const normalized: NormalizedCommand[] = rawCommands.map((cmd) => ({
        name: cmd.name,
        description: cmd.description ?? "",
        kind: cmd.kind,
        agent: cmd.agent,
        model: cmd.model,
      }))

      normalized.sort((a, b) => {
        if (a.kind !== b.kind) {
          return a.kind === "custom" ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })

      setCommands(normalized)
    } catch (err) {
      console.error("[useCommands] Failed to fetch commands:", err)
      setError(String(err))
      setCommands([])
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
