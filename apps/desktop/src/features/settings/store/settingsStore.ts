import { create } from "zustand"
import { loadDesktopStore, type DesktopStoreHandle } from "@/desktop/client"

const STORE_FILE = "settings.json"
const GIT_GENERATION_MODEL_KEY = "gitGenerationModel"
const WORKSPACE_SETUP_MODEL_KEY = "workspaceSetupModel"
const PERSIST_DEBOUNCE_MS = 250

interface SettingsState {
  gitGenerationModel: string
  workspaceSetupModel: string
  hasLoaded: boolean
  initialize: () => Promise<void>
  setGitGenerationModel: (model: string) => void
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

function schedulePersist(settings: { gitGenerationModel: string; workspaceSetupModel: string }): void {
  if (persistTimeoutId != null) {
    clearTimeout(persistTimeoutId)
  }

  persistTimeoutId = setTimeout(() => {
    persistTimeoutId = null

    void (async () => {
      try {
        const store = await getStore()
        await store.set(GIT_GENERATION_MODEL_KEY, settings.gitGenerationModel)
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
        const savedWorkspaceSetupModel = await store.get<string>(WORKSPACE_SETUP_MODEL_KEY)

        set({
          gitGenerationModel: normalizeGitGenerationModel(savedModel),
          workspaceSetupModel: normalizeWorkspaceSetupModel(savedWorkspaceSetupModel),
          hasLoaded: true,
        })
      } catch (error) {
        console.error("Failed to load settings:", error)
        set({
          gitGenerationModel: "",
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
      workspaceSetupModel: normalizeWorkspaceSetupModel(get().workspaceSetupModel),
    })
  },

  resetGitGenerationModel: () => {
    set({ gitGenerationModel: "" })
    schedulePersist({
      gitGenerationModel: "",
      workspaceSetupModel: normalizeWorkspaceSetupModel(get().workspaceSetupModel),
    })
  },

  setWorkspaceSetupModel: (model) => {
    const normalized = normalizeWorkspaceSetupModel(model)
    set({ workspaceSetupModel: normalized })
    schedulePersist({
      gitGenerationModel: normalizeGitGenerationModel(get().gitGenerationModel),
      workspaceSetupModel: normalized,
    })
  },

  resetWorkspaceSetupModel: () => {
    set({ workspaceSetupModel: "" })
    schedulePersist({
      gitGenerationModel: normalizeGitGenerationModel(get().gitGenerationModel),
      workspaceSetupModel: "",
    })
  },
}))

export { normalizeGitGenerationModel, normalizeWorkspaceSetupModel }
