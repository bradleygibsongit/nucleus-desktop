import { describe, expect, test } from "bun:test"

import type { GitBranchesResponse } from "@/desktop/client"
import {
  resolveSidebarBranchIndicator,
  resolveSidebarPullRequestIndicator,
} from "./sidebarGitIndicators"

function createBranchData(
  overrides: Partial<GitBranchesResponse> = {}
): GitBranchesResponse {
  return {
    currentBranch: "feature/sidebar",
    upstreamBranch: "origin/feature/sidebar",
    branches: ["main", "feature/sidebar"],
    remoteNames: ["origin"],
    workingTreeSummary: {
      changedFiles: 0,
      additions: 0,
      deletions: 0,
    },
    aheadCount: 0,
    behindCount: 0,
    hasOriginRemote: true,
    hasUpstream: true,
    defaultBranch: "main",
    isDefaultBranch: false,
    isDetached: false,
    openPullRequest: null,
    ...overrides,
  }
}

describe("resolveSidebarBranchIndicator", () => {
  test("marks diverged branches as danger state", () => {
    const indicator = resolveSidebarBranchIndicator(
      createBranchData({ aheadCount: 2, behindCount: 1 })
    )

    expect(indicator?.colorClass).toContain("text-rose-500")
    expect(indicator?.tooltip).toContain("diverged")
  })

  test("marks dirty branches as warning state", () => {
    const indicator = resolveSidebarBranchIndicator(
      createBranchData({
        workingTreeSummary: {
          changedFiles: 3,
          additions: 10,
          deletions: 2,
        },
      })
    )

    expect(indicator?.colorClass).toContain("text-amber-500")
    expect(indicator?.tooltip).toContain("3 uncommitted changes")
  })

  test("marks ahead branches as success state", () => {
    const indicator = resolveSidebarBranchIndicator(
      createBranchData({ aheadCount: 2 })
    )

    expect(indicator?.colorClass).toContain("text-emerald-500")
    expect(indicator?.tooltip).toContain("2 commits ahead")
  })

  test("marks behind branches as info state", () => {
    const indicator = resolveSidebarBranchIndicator(
      createBranchData({ behindCount: 1 })
    )

    expect(indicator?.colorClass).toContain("text-sky-500")
    expect(indicator?.tooltip).toContain("1 commit behind")
  })
})

describe("resolveSidebarPullRequestIndicator", () => {
  test("returns an open PR indicator", () => {
    const indicator = resolveSidebarPullRequestIndicator(
      createBranchData({
        openPullRequest: {
          number: 42,
          title: "Sidebar polish",
          url: "https://example.com/pr/42",
          state: "open",
          baseBranch: "main",
          headBranch: "feature/sidebar",
          checksStatus: "pending",
          mergeStatus: "blocked",
          isMergeable: false,
        },
      })
    )

    expect(indicator?.colorClass).toContain("text-emerald-500")
    expect(indicator?.tooltip).toContain("PR #42 open")
  })

  test("returns a merged PR indicator", () => {
    const indicator = resolveSidebarPullRequestIndicator(
      createBranchData({
        openPullRequest: {
          number: 99,
          title: "Ship it",
          url: "https://example.com/pr/99",
          state: "merged",
          baseBranch: "main",
          headBranch: "feature/sidebar",
          checksStatus: "passed",
          mergeStatus: "merged",
          isMergeable: false,
        },
      })
    )

    expect(indicator?.colorClass).toContain("text-violet-500")
    expect(indicator?.tooltip).toContain("PR #99 merged")
  })
})
