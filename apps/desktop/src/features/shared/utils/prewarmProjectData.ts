import { useChatStore } from "@/features/chat/store"
import { useProjectGitStore } from "@/features/shared/hooks/projectGitStore"
import { useFileTreeStore } from "@/features/workspace/store"

export type ProjectPrewarmTarget = "files" | "changes" | "checks"

const prewarmPromiseByKey = new Map<string, Promise<void>>()

function trackPrewarm(key: string, load: () => Promise<void>): Promise<void> {
  const inFlightPrewarm = prewarmPromiseByKey.get(key)
  if (inFlightPrewarm) {
    return inFlightPrewarm
  }

  const promise = load().finally(() => {
    prewarmPromiseByKey.delete(key)
  })

  prewarmPromiseByKey.set(key, promise)
  return promise
}

export function prewarmProjectData(
  worktreeId: string | null,
  worktreePath: string | null,
  target: ProjectPrewarmTarget = "changes"
): Promise<void> {
  if (!worktreeId || !worktreePath) {
    return Promise.resolve()
  }

  return trackPrewarm(`${worktreeId}:${worktreePath}:${target}`, async () => {
    const chatStore = useChatStore.getState()
    const gitStore = useProjectGitStore.getState()

    gitStore.ensureEntry(worktreePath)

    await Promise.all([
      chatStore.loadSessionsForProject(worktreeId, worktreePath),
      gitStore.requestRefresh(worktreePath, {
        includeBranches: true,
        includeChanges: true,
        quietBranches: true,
        quietChanges: true,
        debounceMs: 0,
      }),
    ])

    if (target === "files") {
      const fileTreeStore = useFileTreeStore.getState()
      await fileTreeStore.primeProjectPath(worktreePath)
      return
    }

    if (target !== "checks") {
      return
    }

    const branchData = useProjectGitStore.getState().entriesByProjectPath[worktreePath]?.branchData
    if (branchData?.openPullRequest?.state !== "open") {
      return
    }

    await useProjectGitStore.getState().requestRefresh(worktreePath, {
      includePullRequestChecks: true,
      quietPullRequestChecks: true,
      debounceMs: 0,
    })
  })
}
