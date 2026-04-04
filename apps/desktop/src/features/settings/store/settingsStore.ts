import { create } from "zustand"
import { loadDesktopStore, type DesktopStoreHandle } from "@/desktop/client"
import {
  createDefaultGitResolvePrompts,
  normalizeGitResolvePrompts,
  type GitResolvePrompts,
} from "@/features/shared/components/layout/gitResolve"
import type { GitPullRequestResolveReason } from "@/desktop/contracts"

const STORE_FILE = "settings.json"
const GIT_GENERATION_MODEL_KEY = "gitGenerationModel"
const GIT_RESOLVE_PROMPTS_KEY = "gitResolvePrompts"
const WORKSPACE_SETUP_MODEL_KEY = "workspaceSetupModel"
const PERSIST_DEBOUNCE_MS = 250

interface SettingsState {
  gitGenerationModel: string
  gitResolvePrompts: GitResolvePrompts
  workspaceSetupModel: string
  hasLoaded: boolean
  initialize: () => Promise<void>
  setGitGenerationModel: (model: string) => void
  setGitResolvePrompt: (reason: GitPullRequestResolveReason, prompt: string) => void
  resetGitResolvePrompts: () => void
  resetGitGenerationModel: () => void
  setWorkspaceSetupModel: (model: string) => void
  resetWorkspaceSetupModel: () => void
}

let storeInstance: DesktopStoreHandle | null = null
let initializePromise: Promise<void> | null = null
let persistTimeoutId: ReturnType<typeof setTimeout> | null = null

async function getStore(): Promise<DesktopStoreHandle> {
  if (!storeInstance) {
    storeInstance = await loadDesktopStore(STORE_FILE)
  }

  return storeInstance
}

function normalizeGitGenerationModel(model: string | null | undefined): string {
  if (!model) {
    return ""
  }

  return model.trim()
}

function normalizeWorkspaceSetupModel(model: string | null | undefined): string {
  if (!model) {
    return ""
  }

  return model.trim()
}

function schedulePersist(settings: {
  gitGenerationModel: string
  gitResolvePrompts: GitResolvePrompts
  workspaceSetupModel: string
}): void {
  if (persistTimeoutId != null) {
    clearTimeout(persistTimeoutId)
  }

  persistTimeoutId = setTimeout(() => {
    persistTimeoutId = null

    void (async () => {
      try {
        const store = await getStore()
        await store.set(GIT_GENERATION_MODEL_KEY, settings.gitGenerationModel)
        await store.set(GIT_RESOLVE_PROMPTS_KEY, settings.gitResolvePrompts)
        await store.set(WORKSPACE_SETUP_MODEL_KEY, settings.workspaceSetupModel)
        await store.save()
      } catch (error) {
        console.error("Failed to persist settings:", error)
      }
    })()
  }, PERSIST_DEBOUNCE_MS)
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  gitGenerationModel: "",
  gitResolvePrompts: createDefaultGitResolvePrompts(),
  workspaceSetupModel: "",
  hasLoaded: false,

  initialize: async () => {
    if (get().hasLoaded) {
      return
    }

    if (initializePromise) {
      return initializePromise
    }

    initializePromise = (async () => {
      try {
        const store = await getStore()
        const savedModel = await store.get<string>(GIT_GENERATION_MODEL_KEY)
        const savedResolvePrompts =
          await store.get<Partial<Record<GitPullRequestResolveReason, string>>>(GIT_RESOLVE_PROMPTS_KEY)
        const savedWorkspaceSetupModel = await store.get<string>(WORKSPACE_SETUP_MODEL_KEY)

        set({
          gitGenerationModel: normalizeGitGenerationModel(savedModel),
          gitResolvePrompts: normalizeGitResolvePrompts(savedResolvePrompts),
          workspaceSetupModel: normalizeWorkspaceSetupModel(savedWorkspaceSetupModel),
          hasLoaded: true,
        })
      } catch (error) {
        console.error("Failed to load settings:", error)
        set({
          gitGenerationModel: "",
          gitResolvePrompts: createDefaultGitResolvePrompts(),
          workspaceSetupModel: "",
          hasLoaded: true,
        })
      }
    })().finally(() => {
      initializePromise = null
    })

    return initializePromise
  },

  setGitGenerationModel: (model) => {
    const normalized = normalizeGitGenerationModel(model)
    set({ gitGenerationModel: normalized })
    schedulePersist({
      gitGenerationModel: normalized,
      gitResolvePrompts: get().gitResolvePrompts,
      workspaceSetupModel: normalizeWorkspaceSetupModel(get().workspaceSetupModel),
    })
  },

  resetGitGenerationModel: () => {
    set({ gitGenerationModel: "" })
    schedulePersist({
      gitGenerationModel: "",
      gitResolvePrompts: get().gitResolvePrompts,
      workspaceSetupModel: normalizeWorkspaceSetupModel(get().workspaceSetupModel),
    })
  },

  setGitResolvePrompt: (reason, prompt) => {
    const nextPrompts = {
      ...get().gitResolvePrompts,
      [reason]: prompt.replace(/\r\n/g, "\n"),
    }
    set({ gitResolvePrompts: nextPrompts })
    schedulePersist({
      gitGenerationModel: normalizeGitGenerationModel(get().gitGenerationModel),
      gitResolvePrompts: nextPrompts,
      workspaceSetupModel: normalizeWorkspaceSetupModel(get().workspaceSetupModel),
    })
  },

  resetGitResolvePrompts: () => {
    const nextPrompts = createDefaultGitResolvePrompts()
    set({ gitResolvePrompts: nextPrompts })
    schedulePersist({
      gitGenerationModel: normalizeGitGenerationModel(get().gitGenerationModel),
      gitResolvePrompts: nextPrompts,
      workspaceSetupModel: normalizeWorkspaceSetupModel(get().workspaceSetupModel),
    })
  },

  setWorkspaceSetupModel: (model) => {
    const normalized = normalizeWorkspaceSetupModel(model)
    set({ workspaceSetupModel: normalized })
    schedulePersist({
      gitGenerationModel: normalizeGitGenerationModel(get().gitGenerationModel),
      gitResolvePrompts: get().gitResolvePrompts,
      workspaceSetupModel: normalized,
    })
  },

  resetWorkspaceSetupModel: () => {
    set({ workspaceSetupModel: "" })
    schedulePersist({
      gitGenerationModel: normalizeGitGenerationModel(get().gitGenerationModel),
      gitResolvePrompts: get().gitResolvePrompts,
      workspaceSetupModel: "",
    })
  },
}))

export { normalizeGitGenerationModel, normalizeWorkspaceSetupModel }
