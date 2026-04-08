import { useEffect } from "react"
import { DEFAULT_HARNESS_ID } from "../runtime/harnesses"
import type { HarnessId } from "../types"
import {
  EMPTY_HARNESS_MODEL_ENTRY,
  useHarnessModelStore,
} from "../store/harnessModelStore"

export function useModels(harnessId: HarnessId | null) {
  const normalizedHarnessId = harnessId ?? DEFAULT_HARNESS_ID
  const modelsEntry = useHarnessModelStore(
    (state) => state.entries[normalizedHarnessId] ?? EMPTY_HARNESS_MODEL_ENTRY
  )
  const ensureModels = useHarnessModelStore((state) => state.ensureModels)
  const refreshModels = useHarnessModelStore((state) => state.refreshModels)

  useEffect(() => {
    void ensureModels(normalizedHarnessId)
  }, [ensureModels, normalizedHarnessId])

  return {
    models: modelsEntry.models,
    isLoading: modelsEntry.isLoading,
    isRefreshing: modelsEntry.isRefreshing,
    error: modelsEntry.error,
    refetch: () => refreshModels(normalizedHarnessId),
  }
}
