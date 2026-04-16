import type { GitBranchesResponse } from "@/desktop/client"

export interface SidebarBranchIndicator {
  colorClass: string
  tooltip: string
}

export interface SidebarPullRequestIndicator {
  colorClass: string
  tooltip: string
  url: string
}

function formatCommitCount(count: number): string {
  return count === 1 ? "1 commit" : `${count} commits`
}

function formatChangeCount(count: number): string {
  return count === 1 ? "1 uncommitted change" : `${count} uncommitted changes`
}

export function resolveSidebarBranchIndicator(
  branchData: GitBranchesResponse | null
): SidebarBranchIndicator | null {
  if (!branchData) {
    return null
  }

  const branchLabel = branchData.currentBranch
  const upstreamLabel = branchData.upstreamBranch ?? "upstream"
  const changedFiles = branchData.workingTreeSummary.changedFiles
  const isAhead = branchData.aheadCount > 0
  const isBehind = branchData.behindCount > 0

  if (branchData.isDetached) {
    return {
      colorClass: "text-rose-500 dark:text-rose-300/90",
      tooltip: "Detached HEAD",
    }
  }

  if (isAhead && isBehind) {
    return {
      colorClass: "text-rose-500 dark:text-rose-300/90",
      tooltip: `${branchLabel} has diverged from ${upstreamLabel} (${formatCommitCount(
        branchData.aheadCount
      )} ahead, ${formatCommitCount(branchData.behindCount)} behind).`,
    }
  }

  if (changedFiles > 0) {
    return {
      colorClass: "text-amber-500 dark:text-amber-300/90",
      tooltip: `${branchLabel} has ${formatChangeCount(changedFiles)}.`,
    }
  }

  if (isBehind) {
    return {
      colorClass: "text-sky-500 dark:text-sky-300/90",
      tooltip: `${branchLabel} is ${formatCommitCount(branchData.behindCount)} behind ${upstreamLabel}.`,
    }
  }

  if (isAhead) {
    return {
      colorClass: "text-emerald-500 dark:text-emerald-300/90",
      tooltip: branchData.hasUpstream
        ? `${branchLabel} is ${formatCommitCount(branchData.aheadCount)} ahead of ${upstreamLabel}.`
        : `${branchLabel} is ${formatCommitCount(branchData.aheadCount)} ahead with no upstream configured yet.`,
    }
  }

  if (!branchData.hasUpstream) {
    return {
      colorClass: "text-sidebar-foreground/40",
      tooltip: `${branchLabel} has no upstream configured.`,
    }
  }

  return {
    colorClass: "text-sidebar-foreground/40",
    tooltip: branchData.isDefaultBranch
      ? `${branchLabel} is up to date (default branch).`
      : `${branchLabel} is up to date.`,
  }
}

export function resolveSidebarPullRequestIndicator(
  branchData: GitBranchesResponse | null
): SidebarPullRequestIndicator | null {
  const pullRequest = branchData?.openPullRequest
  if (!pullRequest) {
    return null
  }

  if (pullRequest.state === "open") {
    return {
      colorClass: "text-emerald-500 dark:text-emerald-300/90",
      tooltip: `PR #${pullRequest.number} open: ${pullRequest.title}`,
      url: pullRequest.url,
    }
  }

  if (pullRequest.state === "closed") {
    return {
      colorClass: "text-zinc-500 dark:text-zinc-400/80",
      tooltip: `PR #${pullRequest.number} closed: ${pullRequest.title}`,
      url: pullRequest.url,
    }
  }

  return {
    colorClass: "text-violet-500 dark:text-violet-300/90",
    tooltip: `PR #${pullRequest.number} merged: ${pullRequest.title}`,
    url: pullRequest.url,
  }
}
