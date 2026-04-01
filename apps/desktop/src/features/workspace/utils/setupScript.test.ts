import { describe, expect, test } from "bun:test"

import {
  buildWorkspaceSetupScriptEnvironment,
  COPY_ALL_ENV_FILES_SETUP_SNIPPET,
  insertSetupSnippet,
  LEGACY_COPY_ALL_ENV_FILES_SETUP_SNIPPET,
} from "./setupScript"

describe("buildWorkspaceSetupScriptEnvironment", () => {
  test("uses the selected source workspace when building setup variables", () => {
    const environment = buildWorkspaceSetupScriptEnvironment(
      {
        name: "Repo",
        repoRootPath: "/tmp/repo",
        selectedWorktreeId: "source-2",
        rootWorktreeId: "root-1",
        worktrees: [
          {
            id: "root-1",
            name: "Root",
            branchName: "main",
            path: "/tmp/repo",
            createdAt: 1,
            updatedAt: 1,
            source: "root",
            status: "ready",
            intentStatus: "configured",
          },
          {
            id: "source-2",
            name: "Feature",
            branchName: "feature",
            path: "/tmp/repo-feature",
            createdAt: 2,
            updatedAt: 2,
            source: "managed",
            status: "ready",
            intentStatus: "configured",
          },
        ],
      },
      {
        name: "Kolkata",
        path: "/tmp/repo-kolkata",
      },
    )

    expect(environment).toEqual({
      NUCLEUS_PROJECT_ROOT: "/tmp/repo",
      NUCLEUS_WORKSPACE_PATH: "/tmp/repo-kolkata",
      NUCLEUS_WORKSPACE_NAME: "Kolkata",
      NUCLEUS_SOURCE_WORKSPACE_PATH: "/tmp/repo-feature",
      NUCLEUS_SOURCE_WORKSPACE_NAME: "Feature",
    })
  })
})

describe("insertSetupSnippet", () => {
  test("appends the env copy snippet once with spacing", () => {
    const nextScript = insertSetupSnippet("bun install", COPY_ALL_ENV_FILES_SETUP_SNIPPET)

    expect(nextScript).toBe(`bun install\n\n${COPY_ALL_ENV_FILES_SETUP_SNIPPET}`)
    expect(insertSetupSnippet(nextScript, COPY_ALL_ENV_FILES_SETUP_SNIPPET)).toBe(nextScript)
  })

  test("upgrades the older quiet env copy snippet in place", () => {
    const nextScript = insertSetupSnippet(
      `bun install\n\n${LEGACY_COPY_ALL_ENV_FILES_SETUP_SNIPPET}`,
      COPY_ALL_ENV_FILES_SETUP_SNIPPET,
    )

    expect(nextScript).toBe(`bun install\n\n${COPY_ALL_ENV_FILES_SETUP_SNIPPET}`)
  })
})
