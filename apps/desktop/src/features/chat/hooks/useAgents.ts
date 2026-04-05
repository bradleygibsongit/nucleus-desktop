import { useState, useEffect, useCallback } from "react"
import { getHarnessAdapter } from "../runtime/harnesses"
import type { HarnessId } from "../types"

export interface NormalizedAgent {
  name: string
  description: string
  mode: "primary" | "subagent" | "all"
  builtIn: boolean
}

export function useAgents(harnessId: HarnessId | null) {
  const [agents, setAgents] = useState<NormalizedAgent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAgents = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const rawAgents = await getHarnessAdapter(harnessId ?? "codex").listAgents()

      const normalized: NormalizedAgent[] = rawAgents
        .filter((agent) => agent.mode === "subagent" || agent.mode === "all")
        .map((agent) => ({
          name: agent.name,
          description: agent.description ?? "",
          mode: agent.mode,
          builtIn: agent.builtIn,
        }))

      normalized.sort((a, b) => {
        if (a.builtIn !== b.builtIn) {
          return a.builtIn ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })

      setAgents(normalized)
    } catch (err) {
      console.error("[useAgents] Failed to fetch agents:", err)
      setError(String(err))
      setAgents([])
    } finally {
      setIsLoading(false)
    }
  }, [harnessId])

  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  return {
    agents,
    isLoading,
    error,
    refetch: fetchAgents,
  }
}

export function filterAgents(
  agents: NormalizedAgent[],
  query: string
): NormalizedAgent[] {
  const lowerQuery = query.toLowerCase()

  if (!lowerQuery) {
    return agents
  }

  return agents.filter(
    (agent) =>
      agent.name.toLowerCase().includes(lowerQuery) ||
      agent.description.toLowerCase().includes(lowerQuery)
  )
}
