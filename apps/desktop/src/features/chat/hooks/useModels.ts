import { useState, useEffect, useCallback } from "react"
import { getHarnessAdapter } from "../runtime/harnesses"
import type { HarnessId, RuntimeModel } from "../types"

export function useModels(harnessId: HarnessId | null) {
  const [models, setModels] = useState<RuntimeModel[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchModels = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await getHarnessAdapter(harnessId ?? "codex").listModels()
      setModels(response)
    } catch (err) {
      console.error("[useModels] Failed to fetch models:", err)
      setError(String(err))
      setModels([])
    } finally {
      setIsLoading(false)
    }
  }, [harnessId])

  useEffect(() => {
    fetchModels()
  }, [fetchModels])

  return {
    models,
    isLoading,
    error,
    refetch: fetchModels,
  }
}
