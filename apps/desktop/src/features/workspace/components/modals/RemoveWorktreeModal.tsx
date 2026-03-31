import { useMemo, useState } from "react"
import { Trash } from "@/components/icons"
import { desktop } from "@/desktop/client"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/features/shared/components/ui/alert-dialog"
import { useTabStore } from "@/features/editor/store"
import { useTerminalStore } from "@/features/terminal/store/terminalStore"
import { useProjectStore } from "@/features/workspace/store"
import type { Project, ProjectWorktree } from "@/features/workspace/types"

interface RemoveWorktreeModalProps {
  open: boolean
  project: Project | null
  worktree: ProjectWorktree | null
  onOpenChange: (open: boolean) => void
}

export function RemoveWorktreeModal({
  open,
  project,
  worktree,
  onOpenChange,
}: RemoveWorktreeModalProps) {
  const removeWorktree = useProjectStore((state) => state.removeWorktree)
  const removeWorktreeTabs = useTabStore((state) => state.removeWorktreeTabs)
  const removeTerminalProject = useTerminalStore((state) => state.removeProject)
  const terminalStateByProject = useTerminalStore((state) => state.terminalStateByProject)
  const [isRemoving, setIsRemoving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const isRootWorktree = project != null && worktree != null && project.rootWorktreeId === worktree.id
  const isLastWorktree = (project?.worktrees.length ?? 0) <= 1

  const copy = useMemo(() => {
    if (isLastWorktree) {
      return {
        title: "Remove last workspace?",
        action: "Remove workspace",
        description:
          "This only removes the workspace from Nucleus. The folder, files, Git worktree, and any local changes stay on disk. The project will remain in Nucleus, but it will not have any workspaces until you create a new one.",
      }
    }

    if (isRootWorktree) {
      return {
        title: "Remove root workspace?",
        action: "Remove root workspace",
        description:
          "This only removes the root workspace from Nucleus and promotes another workspace in its place. The folder, files, Git worktree, and any local changes stay on disk.",
      }
    }

    return {
      title: "Remove workspace?",
      action: "Remove workspace",
      description:
        "This only removes the workspace from Nucleus. The folder, files, Git worktree, and any local changes stay on disk.",
    }
  }, [isLastWorktree, isRootWorktree])

  const handleRemove = async () => {
    if (!project || !worktree) {
      return
    }

    setIsRemoving(true)
    setErrorMessage(null)

    try {
      const terminalTabs = terminalStateByProject[worktree.id]?.tabs ?? []
      await Promise.allSettled(
        terminalTabs.map((tab) => desktop.terminal.closeSession(`project-terminal:${tab.id}`))
      )

      await removeWorktree(project.id, worktree.id)
      removeWorktreeTabs(worktree.id)
      removeTerminalProject(worktree.id)
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to remove worktree:", error)
      setErrorMessage(error instanceof Error ? error.message : "Couldn't remove this workspace.")
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <Trash />
          </AlertDialogMedia>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {worktree?.name ?? "This workspace"} will be removed.
            {" "}
            {copy.description}
            {errorMessage ? ` ${errorMessage}` : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            type="button"
            variant="destructive"
            onClick={() => void handleRemove()}
            disabled={!project || !worktree || isRemoving}
          >
            {isRemoving ? "Removing..." : copy.action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
