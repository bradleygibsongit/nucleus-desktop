import { beforeEach, describe, expect, mock, test } from "bun:test"
import type { RuntimeModel } from "../types"

const codexListModelsMock = mock(async (): Promise<RuntimeModel[]> => [])
const claudeListModelsMock = mock(async (): Promise<RuntimeModel[]> => [])

mock.module("../runtime/harnesses", () => ({
  listHarnesses: () => [
    {
      id: "codex",
      label: "Codex",
      description: "Codex harness",
      adapterStatus: "experimental",
      capabilities: {
        supportsCommands: false,
        supportsAgentMentions: false,
        supportsFileSearch: false,
        supportsSubagents: false,
        supportsArchive: true,
        supportsDelete: true,
      },
    },
    {
      id: "claude-code",
      label: "Claude Code",
      description: "Claude harness",
      adapterStatus: "planned",
      capabilities: {
        supportsCommands: false,
        supportsAgentMentions: false,
        supportsFileSearch: false,
        supportsSubagents: false,
        supportsArchive: true,
        supportsDelete: true,
      },
    },
  ],
  getHarnessAdapter: (harnessId: "codex" | "claude-code") => ({
    listModels: () =>
      harnessId === "codex"
        ? codexListModelsMock()
        : claudeListModelsMock(),
  }),
}))

const {
  HARNESS_MODEL_CACHE_STALE_MS,
  useHarnessModelStore,
  resetHarnessModelStoreForTests,
} = await import("./harnessModelStore")

const CACHED_MODELS: RuntimeModel[] = [
  {
    id: "gpt-5.4",
    displayName: "GPT-5.4",
    isDefault: true,
  },
]

describe("harnessModelStore", () => {
  beforeEach(() => {
    codexListModelsMock.mockReset()
    claudeListModelsMock.mockReset()
    resetHarnessModelStoreForTests()
  })

  test("dedupes concurrent model fetches per harness", async () => {
    let resolveModels: ((value: RuntimeModel[]) => void) | null = null

    codexListModelsMock.mockImplementation(
      () =>
        new Promise<RuntimeModel[]>((resolve) => {
          resolveModels = resolve
        })
    )

    const firstRequest = useHarnessModelStore.getState().refreshModels("codex")
    const secondRequest = useHarnessModelStore.getState().refreshModels("codex")

    expect(codexListModelsMock).toHaveBeenCalledTimes(1)

    resolveModels?.(CACHED_MODELS)

    expect(await firstRequest).toEqual(CACHED_MODELS)
    expect(await secondRequest).toEqual(CACHED_MODELS)
  })

  test("returns cached models without refetching while the cache is fresh", async () => {
    useHarnessModelStore.setState({
      entries: {
        codex: {
          models: CACHED_MODELS,
          error: null,
          isLoading: false,
          isRefreshing: false,
          hasLoaded: true,
          lastFetchedAt: Date.now(),
        },
      },
    })

    const models = await useHarnessModelStore.getState().ensureModels("codex")

    expect(models).toEqual(CACHED_MODELS)
    expect(codexListModelsMock).toHaveBeenCalledTimes(0)
  })

  test("keeps stale models visible during background refresh", async () => {
    const refreshedModels: RuntimeModel[] = [
      {
        id: "gpt-5.5",
        displayName: "GPT-5.5",
        isDefault: true,
      },
    ]

    let resolveModels: ((value: RuntimeModel[]) => void) | null = null

    codexListModelsMock.mockImplementation(
      () =>
        new Promise<RuntimeModel[]>((resolve) => {
          resolveModels = resolve
        })
    )

    useHarnessModelStore.setState({
      entries: {
        codex: {
          models: CACHED_MODELS,
          error: null,
          isLoading: false,
          isRefreshing: false,
          hasLoaded: true,
          lastFetchedAt: Date.now() - HARNESS_MODEL_CACHE_STALE_MS - 1,
        },
      },
    })

    const models = await useHarnessModelStore.getState().ensureModels("codex")

    expect(models).toEqual(CACHED_MODELS)
    expect(codexListModelsMock).toHaveBeenCalledTimes(1)
    expect(useHarnessModelStore.getState().entries.codex).toMatchObject({
      models: CACHED_MODELS,
      isLoading: false,
      isRefreshing: true,
    })

    resolveModels?.(refreshedModels)
    await Bun.sleep(0)

    expect(useHarnessModelStore.getState().entries.codex).toMatchObject({
      models: refreshedModels,
      isLoading: false,
      isRefreshing: false,
      hasLoaded: true,
      error: null,
    })
  })
})
