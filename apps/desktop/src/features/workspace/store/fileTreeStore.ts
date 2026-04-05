import { create } from "zustand"
import type { FileTreeItem } from "@/features/version-control/types"
import { applyProjectFileSystemEvent } from "@/features/workspace/utils/fileTree"
import { readProjectFiles } from "@/features/workspace/utils/fileSystem"
import {
  listenToProjectFileEvents,
  startProjectFileWatcher,
  stopProjectFileWatcher,
  type ProjectFileSystemEvent,
} from "@/features/workspace/utils/projectWatcher"

interface FileTreeState {
  activeProjectPath: string | null
  dataByProjectPath: Record<string, Record<string, FileTreeItem>>
  loadedByProjectPath: Record<string, boolean>
  loadingByProjectPath: Record<string, boolean>
  lastEventByProjectPath: Record<string, ProjectFileSystemEvent | null>
  staleByProjectPath: Record<string, boolean>
  isInitialized: boolean
  initialize: () => Promise<void>
  primeProjectPath: (projectPath: string) => Promise<void>
  setActiveProjectPath: (projectPath: string | null) => Promise<void>
  refreshActiveProject: () => Promise<void>
}

let unlistenProjectEvents: (() => void) | null = null
let initializePromise: Promise<void> | null = null
let switchingProjectPromise: Promise<void> | null = null
let eventFlushTimeoutId: ReturnType<typeof setTimeout> | null = null
const treeLoadPromiseByProject = new Map<string, Promise<Record<string, FileTreeItem>>>()
const queuedEventsByProject = new Map<string, ProjectFileSystemEvent[]>()

function clearQueuedEvents(projectPath?: string | null): void {
  if (projectPath) {
    queuedEventsByProject.delete(projectPath)
    return
  }

  queuedEventsByProject.clear()
}

function setProjectLoading(
  set: (updater: (state: FileTreeState) => Partial<FileTreeState>) => void,
  projectPath: string,
  isLoading: boolean
): void {
  set((state) => ({
    loadingByProjectPath: {
      ...state.loadingByProjectPath,
      [projectPath]: isLoading,
    },
  }))
}

async function loadProjectTree(projectPath: string): Promise<Record<string, FileTreeItem>> {
  return readProjectFiles(projectPath)
}

async function ensureProjectTreeLoaded(
  projectPath: string,
  get: () => FileTreeState,
  set: (updater: (state: FileTreeState) => Partial<FileTreeState>) => void,
  options?: {
    forceReload?: boolean
    staleAfterLoad?: boolean
  }
): Promise<Record<string, FileTreeItem>> {
  const cachedTree = get().dataByProjectPath[projectPath]
  const isLoaded = get().loadedByProjectPath[projectPath] ?? false
  if (!options?.forceReload && isLoaded) {
    return cachedTree ?? {}
  }

  const inFlightLoad = treeLoadPromiseByProject.get(projectPath)
  if (inFlightLoad) {
    return inFlightLoad
  }

  setProjectLoading(set, projectPath, true)

  const loadPromise = (async () => {
    try {
      const tree = await loadProjectTree(projectPath)
      set((state) => ({
        dataByProjectPath: {
          ...state.dataByProjectPath,
          [projectPath]: tree,
        },
        loadedByProjectPath: {
          ...state.loadedByProjectPath,
          [projectPath]: true,
        },
        staleByProjectPath: {
          ...state.staleByProjectPath,
          [projectPath]: options?.staleAfterLoad ?? false,
        },
      }))
      return tree
    } catch (error) {
      console.error("Failed to load project files:", error)
      const fallbackTree: Record<string, FileTreeItem> = {}
      set((state) => ({
        dataByProjectPath: {
          ...state.dataByProjectPath,
          [projectPath]: fallbackTree,
        },
        loadedByProjectPath: {
          ...state.loadedByProjectPath,
          [projectPath]: true,
        },
        staleByProjectPath: {
          ...state.staleByProjectPath,
          [projectPath]: options?.staleAfterLoad ?? false,
        },
      }))
      return fallbackTree
    } finally {
      setProjectLoading(set, projectPath, false)
      treeLoadPromiseByProject.delete(projectPath)
    }
  })()

  treeLoadPromiseByProject.set(projectPath, loadPromise)
  return loadPromise
}

async function applyQueuedEventsForProject(
  projectPath: string,
  get: () => FileTreeState,
  set: (updater: (state: FileTreeState) => Partial<FileTreeState>) => void
): Promise<void> {
  const queuedEvents = queuedEventsByProject.get(projectPath) ?? []
  queuedEventsByProject.delete(projectPath)

  if (queuedEvents.length === 0) {
    return
  }

  let nextTree = get().dataByProjectPath[projectPath] ?? {}

  for (const event of queuedEvents) {
    const patchedTree = await applyProjectFileSystemEvent(nextTree, projectPath, event)
    if (!patchedTree) {
      const freshTree = await loadProjectTree(projectPath)
      set((state) => ({
        dataByProjectPath: {
          ...state.dataByProjectPath,
          [projectPath]: freshTree,
        },
        loadedByProjectPath: {
          ...state.loadedByProjectPath,
          [projectPath]: true,
        },
        staleByProjectPath: {
          ...state.staleByProjectPath,
          [projectPath]: false,
        },
      }))
      return
    }

    nextTree = patchedTree
  }

  set((state) => ({
    dataByProjectPath: {
      ...state.dataByProjectPath,
      [projectPath]: nextTree,
    },
    loadedByProjectPath: {
      ...state.loadedByProjectPath,
      [projectPath]: true,
    },
    staleByProjectPath: {
      ...state.staleByProjectPath,
      [projectPath]: false,
    },
  }))
}

function scheduleEventFlush(
  get: () => FileTreeState,
  set: (updater: (state: FileTreeState) => Partial<FileTreeState>) => void
): void {
  if (eventFlushTimeoutId) {
    clearTimeout(eventFlushTimeoutId)
  }

  eventFlushTimeoutId = setTimeout(() => {
    eventFlushTimeoutId = null

    void (async () => {
      const { activeProjectPath, loadingByProjectPath } = get()
      if (!activeProjectPath || loadingByProjectPath[activeProjectPath]) {
        return
      }

      await applyQueuedEventsForProject(activeProjectPath, get, set)
    })()
  }, 75)
}

async function ensureProjectListener(
  get: () => FileTreeState,
  set: (updater: (state: FileTreeState) => Partial<FileTreeState>) => void
): Promise<void> {
  if (unlistenProjectEvents) {
    return
  }

  unlistenProjectEvents = await listenToProjectFileEvents((event) => {
    const activeProjectPath = get().activeProjectPath
    if (!activeProjectPath || event.rootPath !== activeProjectPath) {
      return
    }

    const existing = queuedEventsByProject.get(event.rootPath) ?? []
    existing.push(event)
    queuedEventsByProject.set(event.rootPath, existing)
    set((state) => ({
      lastEventByProjectPath: {
        ...state.lastEventByProjectPath,
        [event.rootPath]: event,
      },
    }))
    scheduleEventFlush(get, set)
  })
}

export const useFileTreeStore = create<FileTreeState>((set, get) => ({
  activeProjectPath: null,
  dataByProjectPath: {},
  loadedByProjectPath: {},
  loadingByProjectPath: {},
  lastEventByProjectPath: {},
  staleByProjectPath: {},
  isInitialized: false,

  initialize: async () => {
    if (get().isInitialized) {
      return
    }

    if (initializePromise) {
      return initializePromise
    }

    initializePromise = (async () => {
      await ensureProjectListener(get, set)
      set({ isInitialized: true })
    })().finally(() => {
      initializePromise = null
    })

    return initializePromise
  },

  primeProjectPath: async (projectPath) => {
    if (!projectPath) {
      return
    }

    await get().initialize()
    await ensureProjectTreeLoaded(projectPath, get, set, {
      staleAfterLoad: true,
    })
  },

  setActiveProjectPath: async (projectPath) => {
    if (switchingProjectPromise) {
      await switchingProjectPromise
    }

    switchingProjectPromise = (async () => {
      await get().initialize()

      const previousProjectPath = get().activeProjectPath
      if (previousProjectPath === projectPath) {
        return
      }

      if (eventFlushTimeoutId) {
        clearTimeout(eventFlushTimeoutId)
        eventFlushTimeoutId = null
      }

      clearQueuedEvents(previousProjectPath)
      if (previousProjectPath) {
        set((state) => ({
          staleByProjectPath: {
            ...state.staleByProjectPath,
            [previousProjectPath]: true,
          },
        }))
      }

      if (!projectPath) {
        await stopProjectFileWatcher()
        set({ activeProjectPath: null })
        return
      }

      set({ activeProjectPath: projectPath })

      try {
        await startProjectFileWatcher(projectPath)
      } catch (error) {
        console.error("Failed to start project file watcher:", error)
      }

      await ensureProjectTreeLoaded(projectPath, get, set, {
        forceReload:
          (get().staleByProjectPath[projectPath] ?? false) ||
          !(get().loadedByProjectPath[projectPath] ?? false),
      })

      await applyQueuedEventsForProject(projectPath, get, set)
    })().finally(() => {
      switchingProjectPromise = null
    })

    return switchingProjectPromise
  },

  refreshActiveProject: async () => {
    const projectPath = get().activeProjectPath
    if (!projectPath) {
      return
    }

    setProjectLoading(set, projectPath, true)

    try {
      const tree = await loadProjectTree(projectPath)
      set((state) => ({
        dataByProjectPath: {
          ...state.dataByProjectPath,
          [projectPath]: tree,
        },
        loadedByProjectPath: {
          ...state.loadedByProjectPath,
          [projectPath]: true,
        },
        staleByProjectPath: {
          ...state.staleByProjectPath,
          [projectPath]: false,
        },
      }))
    } catch (error) {
      console.error("Failed to refresh project files:", error)
    } finally {
      setProjectLoading(set, projectPath, false)
    }

    await applyQueuedEventsForProject(projectPath, get, set)
  },
}))
