import { beforeEach, describe, expect, mock, test } from "bun:test"

import type { FileTreeItem } from "@/features/version-control/types"

const projectTrees = new Map<string, Record<string, FileTreeItem>>()
const readCounts = new Map<string, number>()
const startWatcherCalls: string[] = []
let stopWatcherCallCount = 0

mock.module("@/features/workspace/utils/fileSystem", () => ({
  readProjectFiles: async (projectPath: string) => {
    readCounts.set(projectPath, (readCounts.get(projectPath) ?? 0) + 1)
    return structuredClone(projectTrees.get(projectPath) ?? {})
  },
  readProjectSubtree: async () => ({}),
  shouldIgnoreFileSystemEntry: () => false,
}))

mock.module("@/features/workspace/utils/projectWatcher", () => ({
  startProjectFileWatcher: async (projectPath: string) => {
    startWatcherCalls.push(projectPath)
  },
  stopProjectFileWatcher: async () => {
    stopWatcherCallCount += 1
  },
  listenToProjectFileEvents: async (_listener: (event: { rootPath: string }) => void) => () => {},
}))

const { useFileTreeStore } = await import("./fileTreeStore")

function createTree(projectPath: string, names: string[]): Record<string, FileTreeItem> {
  const children = names.map((name) => `${projectPath}/${name}`)

  return {
    root: {
      name: projectPath.split("/").pop() || "root",
      isDirectory: true,
      children,
    },
    ...Object.fromEntries(
      names.map((name) => [
        `${projectPath}/${name}`,
        {
          name,
          isDirectory: false,
        },
      ])
    ),
  }
}

function resetStoreState() {
  useFileTreeStore.setState({
    activeProjectPath: null,
    dataByProjectPath: {},
    loadedByProjectPath: {},
    loadingByProjectPath: {},
    lastEventByProjectPath: {},
    staleByProjectPath: {},
    isInitialized: false,
  })
}

describe("fileTreeStore", () => {
  beforeEach(() => {
    projectTrees.clear()
    readCounts.clear()
    startWatcherCalls.length = 0
    stopWatcherCallCount = 0
    resetStoreState()
  })

  test("reloads a primed tree when the project becomes active", async () => {
    const projectPath = "/tmp/project-alpha"
    projectTrees.set(projectPath, createTree(projectPath, ["before.ts"]))

    await useFileTreeStore.getState().primeProjectPath(projectPath)

    expect(readCounts.get(projectPath)).toBe(1)

    projectTrees.set(projectPath, createTree(projectPath, ["after.ts"]))

    await useFileTreeStore.getState().setActiveProjectPath(projectPath)

    expect(startWatcherCalls).toEqual([projectPath])
    expect(readCounts.get(projectPath)).toBe(2)
    expect(useFileTreeStore.getState().dataByProjectPath[projectPath]).toEqual(
      createTree(projectPath, ["after.ts"])
    )
    expect(useFileTreeStore.getState().staleByProjectPath[projectPath]).toBe(false)
  })

  test("reloads a previously active tree after switching back to it", async () => {
    const alphaPath = "/tmp/project-alpha"
    const betaPath = "/tmp/project-beta"
    projectTrees.set(alphaPath, createTree(alphaPath, ["one.ts"]))
    projectTrees.set(betaPath, createTree(betaPath, ["beta.ts"]))

    await useFileTreeStore.getState().setActiveProjectPath(alphaPath)
    await useFileTreeStore.getState().setActiveProjectPath(betaPath)

    projectTrees.set(alphaPath, createTree(alphaPath, ["two.ts"]))

    await useFileTreeStore.getState().setActiveProjectPath(alphaPath)

    expect(readCounts.get(alphaPath)).toBe(2)
    expect(readCounts.get(betaPath)).toBe(1)
    expect(useFileTreeStore.getState().dataByProjectPath[alphaPath]).toEqual(
      createTree(alphaPath, ["two.ts"])
    )
    expect(useFileTreeStore.getState().staleByProjectPath[alphaPath]).toBe(false)
    expect(useFileTreeStore.getState().staleByProjectPath[betaPath]).toBe(true)
    expect(stopWatcherCallCount).toBe(0)
  })
})
