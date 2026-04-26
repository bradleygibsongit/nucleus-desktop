import { describe, expect, test } from "bun:test"

import { buildResolvePrompt, normalizeGitResolvePrompts } from "./gitResolve"
import type { GitBranchesResponse } from "@/desktop/client"

function createBranchData(
  overrides: Partial<GitBranchesResponse> = {}
): GitBranchesResponse {
  return {
    currentBranch: "feature/header",
    upstreamBranch: "origin/feature/header",
    branches: ["main", "feature/header"],
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
    openPullRequest: {
      number: 42,
      title: "Header polish",
      url: "https://example.com/pr/42",
      state: "open",
      baseBranch: "main",
      headBranch: "feature/header",
      checksStatus: "passed",
      mergeStatus: "blocked",
      isMergeable: false,
      resolveReason: "conflicts",
    },
    ...overrides,
  }
}

describe("gitResolve", () => {
  test("fills in defaults for missing resolve prompts", () => {
    const prompts = normalizeGitResolvePrompts({
      conflicts: "Resolve {{currentBranch}}",
    })

    expect(prompts.conflicts).toBe("Resolve {{currentBranch}}")
    expect(prompts.behind.length).toBeGreaterThan(0)
    expect(prompts.failed_checks.length).toBeGreaterThan(0)
  })

  test("renders a resolve prompt with current PR context", () => {
    const prompt = buildResolvePrompt(
      createBranchData({
        openPullRequest: {
          number: 42,
          title: "Header polish",
          url: "https://example.com/pr/42",
          state: "open",
          baseBranch: "main",
          headBranch: "feature/header",
          checksStatus: "failed",
          mergeStatus: "blocked",
          isMergeable: false,
          resolveReason: "failed_checks",
          failedChecksCount: 2,
          pendingChecksCount: 1,
          passedChecksCount: 4,
          failedCheckNames: ["lint", "test"],
        },
      }),
      normalizeGitResolvePrompts({
        failed_checks: [
          "Fix PR #{{prNumber}} on {{currentBranch}}.",
          "Checks: {{checksStatus}} / {{failedChecksCount}}.",
          "Names: {{failingChecks}}.",
          "{{gitStatusSummary}}",
        ].join("\n"),
      }),
      {
        projectName: "vFactor",
        worktreeName: "Readme Test",
        worktreePath: "/tmp/readme-test",
      }
    )

    expect(prompt).toContain("Fix PR #42 on feature/header.")
    expect(prompt).toContain("Checks: failed / 2.")
    expect(prompt).toContain("Names: lint, test.")
    expect(prompt).toContain("Working tree is clean.")
  })
})
