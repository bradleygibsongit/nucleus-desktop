import { useState, useEffect, useCallback } from "react"
import { useCurrentProjectWorktree } from "@/features/shared/hooks"
import { useChatStore } from "../store/chatStore"
import type { RuntimeModel } from "../types"

export function useModels() {
  const { selectedWorktreeId } = useCurrentProjectWorktree()
  const listModels = useChatStore((state) => state.listModels)
  const [models, setModels] = useState<RuntimeModel[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchModels = useCallback(async () => {
    if (!selectedWorktreeId) {
      setModels([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await listModels(selectedWorktreeId)
      setModels(response)
    } catch (err) {
      console.error("[useModels] Failed to fetch models:", err)
      setError(String(err))
      setModels([])
    } finally {
      setIsLoading(false)
    }
  }, [listModels, selectedWorktreeId])

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
